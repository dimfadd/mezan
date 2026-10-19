import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../app";
import { all, first, run } from "../db/types";
import { ALL_STORE, MANAGEMENT, requireStore, storeOf } from "../lib/auth";
import { fail } from "../lib/http";
import { newId, randomCode } from "../lib/security";
import { awardStamp, memberCard, normalizePhone, redeem } from "../lib/loyalty";
import { addToWaitlist } from "./public";

// Kartu stempel, antrean tunggu, dan promo jam tertentu.
export const guestRoutes = new Hono<Env>();
for (const p of ["/loyalty", "/loyalty/*", "/waitlist", "/waitlist/*", "/price-rules", "/price-rules/*"]) guestRoutes.use(p, requireStore(ALL_STORE));
const mgmt = requireStore(MANAGEMENT);
const bool = z.union([z.boolean(), z.literal(0), z.literal(1)]).transform((v) => (v ? 1 : 0));

// ---------- Kartu stempel ----------

guestRoutes.get("/loyalty", mgmt, async (c) => {
  const t = storeOf(c);
  const q = (c.req.query("q") ?? "").replace(/[^\d\p{L} ]/gu, "").trim();
  const digits = q.replace(/\D/g, "");
  const like = digits ? `%${digits.replace(/^0/, "")}%` : `%${q}%`;
  const members = await all(
    c.var.db,
    `SELECT phone, name, stamps, total_stamps, rewards, created_at, last_visit_at FROM loyalty_members
     WHERE tenant_id = ? ${q ? "AND (phone LIKE ? OR name LIKE ?)" : ""} ORDER BY last_visit_at DESC LIMIT 100`,
    ...(q ? [t.id, like, `%${q}%`] : [t.id]),
  );
  const stats = await first<{ members: number; ready: number; rewards: number }>(
    c.var.db,
    "SELECT COUNT(*) AS members, SUM(CASE WHEN stamps >= ? THEN 1 ELSE 0 END) AS ready, COALESCE(SUM(rewards), 0) AS rewards FROM loyalty_members WHERE tenant_id = ?",
    t.loyalty_target,
    t.id,
  );
  return c.json({
    settings: { enabled: !!t.loyalty_enabled, target: t.loyalty_target, min_spend: t.loyalty_min_spend, reward: t.loyalty_reward },
    members,
    stats: { members: stats?.members ?? 0, ready: stats?.ready ?? 0, rewards: stats?.rewards ?? 0 },
  });
});

guestRoutes.put("/loyalty", mgmt, async (c) => {
  const t = storeOf(c);
  const b = z
    .object({
      enabled: bool,
      target: z.number().int().min(2, "Minimal 2 stempel.").max(50, "Maksimal 50 stempel."),
      min_spend: z.number().int().min(0).max(10_000_000),
      reward: z.string().trim().max(80),
    })
    .refine((v) => !v.enabled || v.reward.length > 0, "Tulis hadiahnya, mis. 1 Es Teh gratis.")
    .parse(await c.req.json());
  await run(c.var.db, "UPDATE tenants SET loyalty_enabled = ?, loyalty_target = ?, loyalty_min_spend = ?, loyalty_reward = ? WHERE id = ?", b.enabled, b.target, b.min_spend, b.reward, t.id);
  return c.json({ ok: true });
});

// Kasir mengetik nomor HP: tampilkan kartunya supaya bisa bilang "tinggal 2 lagi" atau menukar hadiah.
guestRoutes.get("/loyalty/lookup", async (c) => {
  const t = storeOf(c);
  if (!t.loyalty_enabled) return c.json({ enabled: false, card: null });
  const phone = normalizePhone(c.req.query("phone"));
  if (!phone) return c.json({ enabled: true, card: null, valid: false });
  return c.json({ enabled: true, valid: true, card: await memberCard(c.var.db, t, phone) });
});

guestRoutes.post("/loyalty/redeem", async (c) => {
  const t = storeOf(c);
  if (!t.loyalty_enabled) fail(409, "Kartu stempel belum dinyalakan.");
  const phone = normalizePhone(z.object({ phone: z.string().max(30) }).parse(await c.req.json()).phone);
  if (!phone) fail(400, "Nomor HP belum benar.");
  const card = await redeem(c.var.db, t, phone, c.var.user!.id);
  if (!card) fail(409, "Stempelnya belum cukup untuk ditukar.");
  return c.json({ card });
});

// Stempel untuk pesanan yang sudah dibayar tapi nomor HP-nya baru disebut belakangan.
guestRoutes.post("/loyalty/stamp", async (c) => {
  const t = storeOf(c);
  if (!t.loyalty_enabled) fail(409, "Kartu stempel belum dinyalakan.");
  const b = z.object({ orderId: z.string().max(64), phone: z.string().max(30) }).parse(await c.req.json());
  if (!normalizePhone(b.phone)) fail(400, "Nomor HP belum benar. Contoh: 0812 3456 7890.");
  const o = await first<{ customer_name: string }>(c.var.db, "SELECT customer_name FROM orders WHERE id = ? AND tenant_id = ?", b.orderId, t.id);
  if (!o) fail(404, "Pesanan tidak ditemukan.");
  const r = await awardStamp(c.var.db, t, b.orderId, b.phone, o.customer_name, c.var.user!.id);
  if (!r) fail(409, "Stempel hanya untuk pesanan yang sudah dibayar.");
  return c.json(r);
});

// ---------- Antrean tunggu ----------

guestRoutes.get("/waitlist", async (c) => {
  const t = storeOf(c);
  const since = Date.now() - 18 * 3600_000;
  const [open, done] = await Promise.all([
    all(c.var.db, "SELECT id, number, name, party_size, phone, note, source, status, created_at, called_at, table_label FROM waitlist WHERE tenant_id = ? AND status IN ('waiting','called') AND created_at > ? ORDER BY created_at", t.id, since),
    all(c.var.db, "SELECT id, number, name, party_size, status, created_at, done_at, table_label FROM waitlist WHERE tenant_id = ? AND status IN ('seated','cancelled','noshow') AND created_at > ? ORDER BY done_at DESC LIMIT 20", t.id, since),
  ]);
  return c.json({ settings: { enabled: !!t.waitlist_enabled, code: t.waitlist_code }, open, done });
});

guestRoutes.post("/waitlist", async (c) => {
  const t = storeOf(c);
  const b = z
    .object({ name: z.string().trim().min(1, "Isi nama tamu.").max(40), party: z.number().int().min(1).max(50), phone: z.string().trim().max(30).default(""), note: z.string().trim().max(120).default("") })
    .parse(await c.req.json());
  const phone = b.phone ? normalizePhone(b.phone) : "";
  if (phone === null) fail(400, "Nomor HP belum benar. Contoh: 0812 3456 7890.");
  const r = await addToWaitlist(c.var.db, t, { name: b.name, party: b.party, phone, source: "kasir", note: b.note });
  if (!r) fail(429, "Antrean hari ini sudah 60 rombongan. Selesaikan yang lama dulu.");
  return c.json(r, 201);
});

const WAIT_NEXT: Record<string, string[]> = {
  waiting: ["called", "seated", "cancelled"],
  called: ["seated", "noshow", "waiting", "cancelled"],
};

guestRoutes.patch("/waitlist/:id", async (c) => {
  const t = storeOf(c);
  const b = z.object({ status: z.enum(["waiting", "called", "seated", "cancelled", "noshow"]), table_label: z.string().trim().max(30).optional() }).parse(await c.req.json());
  const w = await first<{ status: string }>(c.var.db, "SELECT status FROM waitlist WHERE id = ? AND tenant_id = ?", c.req.param("id"), t.id);
  if (!w) fail(404, "Antrean tidak ditemukan.");
  if (!WAIT_NEXT[w.status]?.includes(b.status)) fail(409, "Antrean ini sudah berubah. Muat ulang.");
  const now = Date.now();
  await run(
    c.var.db,
    `UPDATE waitlist SET status = ?, called_at = CASE WHEN ? = 'called' THEN ? ELSE called_at END,
       done_at = CASE WHEN ? IN ('seated','cancelled','noshow') THEN ? ELSE NULL END, table_label = COALESCE(?, table_label)
     WHERE id = ? AND tenant_id = ? AND status = ?`,
    b.status, b.status, now, b.status, now, b.table_label || null, c.req.param("id"), t.id, w.status,
  );
  return c.json({ ok: true });
});

guestRoutes.put("/waitlist-settings", mgmt, async (c) => {
  const t = storeOf(c);
  const b = z.object({ enabled: bool }).parse(await c.req.json());
  const code = t.waitlist_code ?? randomCode(12);
  await run(c.var.db, "UPDATE tenants SET waitlist_enabled = ?, waitlist_code = ? WHERE id = ?", b.enabled, code, t.id);
  return c.json({ ok: true, code });
});

guestRoutes.post("/waitlist-settings/regenerate", mgmt, async (c) => {
  const t = storeOf(c);
  const code = randomCode(12);
  await run(c.var.db, "UPDATE tenants SET waitlist_code = ? WHERE id = ?", code, t.id);
  return c.json({ ok: true, code });
});

// ---------- Promo jam tertentu (happy hour) ----------

const ruleSchema = z
  .object({
    name: z.string().trim().min(1, "Beri nama promonya, mis. Happy hour sore.").max(40),
    percent: z.number().int().min(1, "Diskon minimal 1%.").max(90, "Diskon maksimal 90%."),
    days: z.number().int().min(1, "Pilih minimal satu hari.").max(127),
    start_min: z.number().int().min(0).max(1439),
    end_min: z.number().int().min(0).max(1439),
    category_ids: z.array(z.string().max(64)).max(50).default([]),
    active: bool.default(1),
  })
  .refine((v) => v.start_min !== v.end_min, "Jam mulai dan jam selesai tidak boleh sama.");

async function checkCats(c: { var: Env["Variables"] }, tenantId: string, ids: string[]) {
  if (!ids.length) return "";
  const ok = await all<{ id: string }>(c.var.db, `SELECT id FROM categories WHERE tenant_id = ? AND id IN (${ids.map(() => "?").join(",")})`, tenantId, ...ids);
  if (ok.length !== new Set(ids).size) fail(400, "Ada kategori yang tidak ditemukan.");
  return [...new Set(ids)].join(",");
}

guestRoutes.get("/price-rules", async (c) => {
  const t = storeOf(c);
  return c.json({ rules: await all(c.var.db, "SELECT id, name, percent, days, start_min, end_min, category_ids, active FROM price_rules WHERE tenant_id = ? ORDER BY start_min, name", t.id) });
});

guestRoutes.post("/price-rules", mgmt, async (c) => {
  const t = storeOf(c);
  const b = ruleSchema.parse(await c.req.json());
  const n = await first<{ n: number }>(c.var.db, "SELECT COUNT(*) AS n FROM price_rules WHERE tenant_id = ?", t.id);
  if ((n?.n ?? 0) >= 20) fail(400, "Maksimal 20 promo. Hapus promo lama dulu.");
  const id = newId();
  await run(c.var.db, "INSERT INTO price_rules (id, tenant_id, name, percent, days, start_min, end_min, category_ids, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    id, t.id, b.name, b.percent, b.days, b.start_min, b.end_min, await checkCats(c, t.id, b.category_ids), b.active, Date.now());
  return c.json({ id }, 201);
});

guestRoutes.put("/price-rules/:id", mgmt, async (c) => {
  const t = storeOf(c);
  const b = ruleSchema.parse(await c.req.json());
  const n = await run(c.var.db, "UPDATE price_rules SET name = ?, percent = ?, days = ?, start_min = ?, end_min = ?, category_ids = ?, active = ? WHERE id = ? AND tenant_id = ?",
    b.name, b.percent, b.days, b.start_min, b.end_min, await checkCats(c, t.id, b.category_ids), b.active, c.req.param("id"), t.id);
  if (!n) fail(404, "Promo tidak ditemukan.");
  return c.json({ ok: true });
});

guestRoutes.delete("/price-rules/:id", mgmt, async (c) => {
  const t = storeOf(c);
  const n = await run(c.var.db, "DELETE FROM price_rules WHERE id = ? AND tenant_id = ?", c.req.param("id"), t.id);
  if (!n) fail(404, "Promo tidak ditemukan.");
  return c.json({ ok: true });
});
