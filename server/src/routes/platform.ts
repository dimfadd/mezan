import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../app";
import { all, first, run, stmt } from "../db/types";
import { GRACE_DAYS, requirePlatform } from "../lib/auth";
import { fail } from "../lib/http";
import { hashPassword, newId, randomCode } from "../lib/security";

export const platformRoutes = new Hono<Env>();
platformRoutes.use("*", requirePlatform);

const DAY_MS = 86_400_000;
const bool = z.union([z.boolean(), z.literal(0), z.literal(1)]).transform((v) => (v ? 1 : 0));

platformRoutes.get("/overview", async (c) => {
  const db = c.var.db;
  const now = Date.now();
  const graceCut = now - GRACE_DAYS * DAY_MS;
  const [counts, mrr, expiring, recentPayments, signups] = await Promise.all([
    first<Record<string, number>>(db, `SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN status = 'trial' AND period_end >= ? THEN 1 END) AS trial,
        COUNT(CASE WHEN status = 'active' AND period_end >= ? THEN 1 END) AS active,
        COUNT(CASE WHEN status != 'suspended' AND period_end < ? THEN 1 END) AS lapsed,
        COUNT(CASE WHEN status = 'suspended' THEN 1 END) AS suspended
      FROM tenants`, graceCut, graceCut, graceCut),
    // Pendapatan berulang bulanan: jumlah harga paket dari toko yang langganannya aktif (bukan trial).
    first<{ mrr: number }>(db, `SELECT COALESCE(SUM(p.price_monthly), 0) AS mrr FROM tenants t JOIN plans p ON p.id = t.plan_id
       WHERE t.status = 'active' AND t.period_end >= ?`, graceCut),
    all(db, `SELECT t.id, t.name, t.status, t.period_end, p.name AS plan_name FROM tenants t JOIN plans p ON p.id = t.plan_id
       WHERE t.status != 'suspended' AND t.period_end BETWEEN ? AND ? ORDER BY t.period_end LIMIT 10`, now - GRACE_DAYS * DAY_MS, now + 7 * DAY_MS),
    all(db, `SELECT s.amount, s.months, s.created_at, t.name AS tenant_name FROM subscription_payments s JOIN tenants t ON t.id = s.tenant_id
       ORDER BY s.created_at DESC LIMIT 8`),
    first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM tenants WHERE created_at >= ?", now - 30 * DAY_MS),
  ]);
  return c.json({ counts, mrr: mrr?.mrr ?? 0, expiring, recentPayments, signups30: signups?.n ?? 0 });
});

platformRoutes.get("/tenants", async (c) => {
  const q = c.req.query("q")?.trim();
  const args: unknown[] = [];
  let where = "";
  if (q) {
    where = "WHERE t.name LIKE ? OR t.slug LIKE ? OR EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = t.id AND u.login LIKE ?)";
    args.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const tenants = await all(
    c.var.db,
    `SELECT t.id, t.slug, t.name, t.kind, t.status, t.period_end, t.created_at, t.plan_id, p.name AS plan_name, p.price_monthly,
       (SELECT login FROM users u WHERE u.tenant_id = t.id AND u.role = 'owner' ORDER BY u.created_at LIMIT 1) AS owner_login,
       (SELECT name FROM users u WHERE u.tenant_id = t.id AND u.role = 'owner' ORDER BY u.created_at LIMIT 1) AS owner_name,
       (SELECT MAX(created_at) FROM orders o WHERE o.tenant_id = t.id) AS last_order_at,
       (SELECT COUNT(*) FROM orders o WHERE o.tenant_id = t.id AND o.created_at >= ?) AS orders_30d
     FROM tenants t JOIN plans p ON p.id = t.plan_id ${where} ORDER BY t.created_at DESC LIMIT 200`,
    Date.now() - 30 * DAY_MS,
    ...args,
  );
  return c.json({ tenants });
});

const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(80),
  kind: z.enum(["resto", "kafe", "warung", "toko"]),
  plan_id: z.string(),
  trial_days: z.number().int().min(0).max(90).default(14),
  owner_name: z.string().trim().min(2).max(80),
  owner_login: z.string().trim().toLowerCase().min(3).max(120).regex(/^[a-z0-9._@+-]+$/),
  owner_password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(200),
});

platformRoutes.post("/tenants", async (c) => {
  const b = createTenantSchema.parse(await c.req.json());
  const db = c.var.db;
  if (!(await first(db, "SELECT 1 FROM plans WHERE id = ?", b.plan_id))) fail(400, "Paket tidak ditemukan.");
  if (await first(db, "SELECT 1 FROM users WHERE login = ?", b.owner_login)) fail(409, "Login pemilik sudah dipakai.");
  let slug = b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "toko";
  if (await first(db, "SELECT 1 FROM tenants WHERE slug = ?", slug)) slug = `${slug}-${randomCode(4)}`;
  const now = Date.now();
  const id = newId();
  await db.batch([
    stmt(db, "INSERT INTO tenants (id, slug, name, kind, plan_id, status, period_end, created_at) VALUES (?, ?, ?, ?, ?, 'trial', ?, ?)", id, slug, b.name, b.kind, b.plan_id, now + b.trial_days * DAY_MS, now),
    stmt(db, "INSERT INTO users (id, tenant_id, name, login, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, 'owner', ?)", newId(), id, b.owner_name, b.owner_login, await hashPassword(b.owner_password), now),
  ]);
  return c.json({ id }, 201);
});

platformRoutes.get("/tenants/:id", async (c) => {
  const id = c.req.param("id");
  const tenant = await first(c.var.db, "SELECT t.*, p.name AS plan_name, p.price_monthly FROM tenants t JOIN plans p ON p.id = t.plan_id WHERE t.id = ?", id);
  if (!tenant) fail(404, "Toko tidak ditemukan.");
  const [users, payments, stats] = await Promise.all([
    all(c.var.db, "SELECT id, name, login, role, active, last_login_at FROM users WHERE tenant_id = ? ORDER BY role, name", id),
    all(c.var.db, "SELECT s.id, s.amount, s.months, s.method, s.note, s.created_at, s.period_end_after, p.name AS plan_name FROM subscription_payments s JOIN plans p ON p.id = s.plan_id WHERE s.tenant_id = ? ORDER BY s.created_at DESC", id),
    first(c.var.db, `SELECT COUNT(*) AS orders, COALESCE(SUM(CASE WHEN payment_status = 'paid' AND status != 'cancelled' THEN total END), 0) AS gmv,
       (SELECT COUNT(*) FROM menu_items WHERE tenant_id = ? AND archived = 0) AS items,
       (SELECT COUNT(*) FROM dining_tables WHERE tenant_id = ?) AS tables
       FROM orders WHERE tenant_id = ? AND created_at >= ?`, id, id, id, Date.now() - 30 * DAY_MS),
  ]);
  return c.json({ tenant, users, payments, stats });
});

const updateTenantSchema = z.object({
  plan_id: z.string(),
  status: z.enum(["trial", "active", "past_due", "suspended"]),
  period_end: z.number().int().positive(),
});

platformRoutes.put("/tenants/:id", async (c) => {
  const b = updateTenantSchema.parse(await c.req.json());
  if (!(await first(c.var.db, "SELECT 1 FROM plans WHERE id = ?", b.plan_id))) fail(400, "Paket tidak ditemukan.");
  const n = await run(c.var.db, "UPDATE tenants SET plan_id = ?, status = ?, period_end = ? WHERE id = ?", b.plan_id, b.status, b.period_end, c.req.param("id"));
  if (!n) fail(404, "Toko tidak ditemukan.");
  return c.json({ ok: true });
});

const paymentSchema = z.object({
  plan_id: z.string(),
  months: z.number().int().min(1).max(24),
  amount: z.number().int().min(0),
  method: z.string().trim().min(1).max(30),
  note: z.string().trim().max(200).default(""),
});

// Catat pembayaran langganan (manual). Masa aktif diperpanjang dari tanggal akhir atau dari hari ini, mana yang lebih akhir.
platformRoutes.post("/tenants/:id/payments", async (c) => {
  const b = paymentSchema.parse(await c.req.json());
  const id = c.req.param("id");
  const t = await first<{ period_end: number; status: string }>(c.var.db, "SELECT period_end, status FROM tenants WHERE id = ?", id);
  if (!t) fail(404, "Toko tidak ditemukan.");
  if (!(await first(c.var.db, "SELECT 1 FROM plans WHERE id = ?", b.plan_id))) fail(400, "Paket tidak ditemukan.");
  const base = t.status === "trial" ? Date.now() : Math.max(t.period_end, Date.now());
  const end = new Date(base);
  end.setMonth(end.getMonth() + b.months);
  const periodEnd = end.getTime();
  await c.var.db.batch([
    stmt(c.var.db, `INSERT INTO subscription_payments (id, tenant_id, plan_id, amount, months, method, note, period_end_after, recorded_by, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, newId(), id, b.plan_id, b.amount, b.months, b.method, b.note, periodEnd, c.var.user!.id, Date.now()),
    stmt(c.var.db, "UPDATE tenants SET plan_id = ?, status = 'active', period_end = ? WHERE id = ?", b.plan_id, periodEnd, id),
  ]);
  return c.json({ ok: true, period_end: periodEnd }, 201);
});

platformRoutes.post("/users/:id/reset-password", async (c) => {
  const b = z.object({ password: z.string().min(8, "Kata sandi minimal 8 karakter.").max(200) }).parse(await c.req.json());
  const id = c.req.param("id");
  const u = await first<{ role: string }>(c.var.db, "SELECT role FROM users WHERE id = ?", id);
  if (!u) fail(404, "Akun tidak ditemukan.");
  if (u.role === "platform_admin") fail(403, "Sandi admin platform diganti lewat Akun saya.");
  await c.var.db.batch([
    stmt(c.var.db, "UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(b.password), id),
    stmt(c.var.db, "DELETE FROM sessions WHERE user_id = ?", id),
  ]);
  return c.json({ ok: true });
});

// ---------- Paket langganan ----------

platformRoutes.get("/plans", async (c) => {
  return c.json({
    plans: await all(c.var.db, "SELECT p.*, (SELECT COUNT(*) FROM tenants t WHERE t.plan_id = p.id) AS tenant_count FROM plans p ORDER BY p.sort, p.price_monthly"),
  });
});

const planSchema = z.object({
  code: z.string().trim().toLowerCase().min(2).max(30).regex(/^[a-z0-9-]+$/, "Kode hanya huruf kecil, angka, dan tanda minus."),
  name: z.string().trim().min(2).max(40),
  price_monthly: z.number().int().min(0),
  max_tables: z.number().int().min(1).max(1000),
  max_staff: z.number().int().min(0).max(500),
  allow_video: bool,
  allow_inventory: bool,
  allow_analytics: bool,
  active: bool,
  sort: z.number().int().min(0).max(100).default(0),
});

platformRoutes.post("/plans", async (c) => {
  const b = planSchema.parse(await c.req.json());
  if (await first(c.var.db, "SELECT 1 FROM plans WHERE code = ?", b.code)) fail(409, "Kode paket sudah dipakai.");
  const id = newId();
  await run(c.var.db, `INSERT INTO plans (id, code, name, price_monthly, max_tables, max_staff, allow_video, allow_inventory, allow_analytics, active, sort, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, b.code, b.name, b.price_monthly, b.max_tables, b.max_staff, b.allow_video, b.allow_inventory, b.allow_analytics, b.active, b.sort, Date.now());
  return c.json({ id }, 201);
});

platformRoutes.put("/plans/:id", async (c) => {
  const b = planSchema.parse(await c.req.json());
  const dup = await first<{ id: string }>(c.var.db, "SELECT id FROM plans WHERE code = ?", b.code);
  if (dup && dup.id !== c.req.param("id")) fail(409, "Kode paket sudah dipakai.");
  const n = await run(c.var.db, `UPDATE plans SET code=?, name=?, price_monthly=?, max_tables=?, max_staff=?, allow_video=?, allow_inventory=?, allow_analytics=?, active=?, sort=? WHERE id=?`,
    b.code, b.name, b.price_monthly, b.max_tables, b.max_staff, b.allow_video, b.allow_inventory, b.allow_analytics, b.active, b.sort, c.req.param("id"));
  if (!n) fail(404, "Paket tidak ditemukan.");
  return c.json({ ok: true });
});
