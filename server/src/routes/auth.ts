import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../app";
import { all, first, run, stmt } from "../db/types";
import { endSession, startSession, tenantLocked, GRACE_DAYS } from "../lib/auth";
import { fail } from "../lib/http";
import { hashPassword, newId, randomCode, verifyPassword } from "../lib/security";

export const authRoutes = new Hono<Env>();

// Pembatas percobaan per akun (bukan per IP, karena header IP bisa dipalsukan).
// Disimpan di memori proses; di Cloudflare ganti dengan binding Rate Limiting atau KV.
const attempts = new Map<string, { n: number; until: number }>();
function checkRate(key: string, max = 8) {
  const a = attempts.get(key);
  if (a && a.until > Date.now() && a.n >= max) fail(429, "Terlalu banyak percobaan. Tunggu 10 menit lalu coba lagi.");
}
function bump(key: string) {
  const now = Date.now();
  if (attempts.size > 5000) for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
  const a = attempts.get(key);
  if (!a || a.until < now) attempts.set(key, { n: 1, until: now + 10 * 60_000 });
  else a.n++;
}

const loginSchema = z.object({
  login: z.string().trim().min(1, "Isi email atau username.").max(120),
  password: z.string().min(1, "Isi kata sandi.").max(200),
});

authRoutes.post("/login", async (c) => {
  const body = loginSchema.parse(await c.req.json());
  const login = body.login.toLowerCase();
  const key = `login|${login}`;
  checkRate(key);
  const user = await first<{ id: string; password_hash: string; active: number }>(
    c.var.db,
    "SELECT id, password_hash, active FROM users WHERE login = ?",
    login,
  );
  if (!user || !(await verifyPassword(body.password, user.password_hash))) {
    bump(key);
    fail(401, "Email/username atau kata sandi tidak cocok.");
  }
  if (!user.active) fail(403, "Akun ini sudah dinonaktifkan. Hubungi pemilik toko.");
  attempts.delete(key);
  await run(c.var.db, "UPDATE users SET last_login_at = ? WHERE id = ?", Date.now(), user.id);
  await startSession(c, user.id);
  return c.json({ ok: true });
});

authRoutes.post("/logout", async (c) => {
  await endSession(c);
  return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
  const user = c.var.user;
  if (!user) return c.json({ user: null });
  const t = c.var.tenant;
  return c.json({
    user,
    tenant: t && {
      ...t,
      locked: tenantLocked(t),
      grace_days: GRACE_DAYS,
    },
  });
});

const registerSchema = z.object({
  storeName: z.string().trim().min(2, "Nama usaha minimal 2 huruf.").max(80),
  kind: z.enum(["resto", "kafe", "warung", "toko"]),
  ownerName: z.string().trim().min(2, "Isi nama kamu.").max(80),
  login: z.string().trim().toLowerCase().min(3, "Email minimal 3 huruf.").max(120)
    .regex(/^[a-z0-9._@+-]+$/, "Pakai huruf, angka, titik, atau @ saja."),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(200),
});

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "toko";
}

// Daftar mandiri: membuat toko baru dengan masa coba 14 hari pada paket termurah yang aktif.
authRoutes.post("/register", async (c) => {
  const b = registerSchema.parse(await c.req.json());
  // Batas kasar pendaftaran per alamat (cf-connecting-ip hanya dipasang oleh Cloudflare).
  const ip = c.req.header("cf-connecting-ip");
  if (ip) {
    checkRate(`register|${ip}`, 5);
    bump(`register|${ip}`);
  }
  const db = c.var.db;
  if (await first(db, "SELECT 1 FROM users WHERE login = ?", b.login)) fail(409, "Email/username ini sudah dipakai.");
  const plans = await all<{ id: string }>(db, "SELECT id FROM plans WHERE active = 1 ORDER BY sort, price_monthly LIMIT 1");
  if (!plans[0]) fail(400, "Pendaftaran belum dibuka. Admin belum menyiapkan paket.");
  let slug = slugify(b.storeName);
  if (await first(db, "SELECT 1 FROM tenants WHERE slug = ?", slug)) slug = `${slug}-${randomCode(4)}`;
  const now = Date.now();
  const tenantId = newId();
  const userId = newId();
  await db.batch([
    stmt(db, `INSERT INTO tenants (id, slug, name, kind, plan_id, status, period_end, created_at)
              VALUES (?, ?, ?, ?, ?, 'trial', ?, ?)`, tenantId, slug, b.storeName, b.kind, plans[0].id, now + 14 * 86_400_000, now),
    stmt(db, `INSERT INTO users (id, tenant_id, name, login, password_hash, role, created_at)
              VALUES (?, ?, ?, ?, ?, 'owner', ?)`, userId, tenantId, b.ownerName, b.login, await hashPassword(b.password), now),
    stmt(db, "INSERT INTO categories (id, tenant_id, name, sort, created_at) VALUES (?, ?, 'Makanan', 1, ?)", newId(), tenantId, now),
    stmt(db, "INSERT INTO categories (id, tenant_id, name, sort, created_at) VALUES (?, ?, 'Minuman', 2, ?)", newId(), tenantId, now),
  ]);
  await startSession(c, userId);
  return c.json({ ok: true }, 201);
});

const pwSchema = z.object({
  current: z.string().min(1, "Isi kata sandi lama."),
  next: z.string().min(8, "Kata sandi baru minimal 8 karakter.").max(200),
});

authRoutes.post("/password", async (c) => {
  const u = c.var.user;
  if (!u) fail(401, "Sesi kamu habis. Silakan masuk lagi.");
  const b = pwSchema.parse(await c.req.json());
  const row = await first<{ password_hash: string }>(c.var.db, "SELECT password_hash FROM users WHERE id = ?", u.id);
  if (!row || !(await verifyPassword(b.current, row.password_hash))) fail(400, "Kata sandi lama tidak cocok.");
  await run(c.var.db, "UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(b.next), u.id);
  // Keluarkan semua perangkat lain, lalu buat sesi baru untuk perangkat ini.
  await run(c.var.db, "DELETE FROM sessions WHERE user_id = ?", u.id);
  await startSession(c, u.id);
  return c.json({ ok: true });
});
