import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../app";
import { all, first, run, stmt } from "../db/types";
import { TENANT_SELECT, tenantLocked, type Tenant } from "../lib/auth";
import { fail } from "../lib/http";
import { createOrder, loadOrderItems, loadPriceRules } from "../lib/orders";
import { attachPairs } from "../lib/pairs";
import { awardStamp, memberCard, normalizePhone } from "../lib/loyalty";
import { orderEta } from "../lib/eta";
import { loadSite } from "../lib/site";
import { loadItemVariants } from "../lib/variants";
import { publicSite } from "../../../shared/site";
import { businessDay } from "../lib/http";
import { randomToken } from "../lib/security";
import { loadGalleries } from "../lib/gallery";
import { checkGeo, geoActive } from "../lib/geo";
import { newId } from "../lib/security";
import { pickLang, serverMsgs, type Lang } from "../../../shared/i18n";
import { DEFAULT_THEME, normalizeTheme } from "../../../shared/menuTheme";

// Paket tanpa branding (atau yang turun paket) otomatis kembali ke template bawaan.
export function publicTheme(t: Tenant) {
  if (!t.allow_branding) return DEFAULT_THEME;
  try {
    return normalizeTheme(JSON.parse(t.menu_theme || "{}"));
  } catch {
    return DEFAULT_THEME;
  }
}

export const publicRoutes = new Hono<Env>();

type TableRow = { id: string; tenant_id: string; label: string; area: string; active: number };

/**
 * Kode QR bisa milik satu meja, atau QR bawa pulang milik toko.
 * Keduanya kode acak, jadi tidak bisa ditebak dengan menaikkan nomor.
 */
async function resolveCode(c: { var: Env["Variables"] }, code: string, lang: Lang = "id") {
  const M = serverMsgs(lang);
  const table = await first<TableRow>(c.var.db, "SELECT id, tenant_id, label, area, active FROM dining_tables WHERE code = ?", code);
  if (table) {
    if (!table.active) fail(404, M.tableUnknown);
    const tenant = await first<Tenant>(c.var.db, `${TENANT_SELECT} WHERE t.id = ?`, table.tenant_id);
    if (!tenant) fail(404, M.storeMissing);
    return { table: table as TableRow | null, tenant };
  }
  const tenant = await first<Tenant>(c.var.db, `${TENANT_SELECT} WHERE t.takeaway_code = ? AND t.takeaway_qr_enabled = 1`, code);
  if (!tenant) fail(404, M.tableUnknown);
  return { table: null as TableRow | null, tenant };
}

// Menu untuk pelanggan yang memindai QR meja.
publicRoutes.get("/table/:code", async (c) => {
  const { table, tenant } = await resolveCode(c, c.req.param("code"), pickLang(c.req.query("lang")));
  const categories = await all(c.var.db, "SELECT id, name, name_en FROM categories WHERE tenant_id = ? ORDER BY sort, name", tenant.id);
  const items = await all<Record<string, unknown> & { id: string; track_stock: number; stock_qty: number }>(
    c.var.db,
    `SELECT id, category_id, name, description, price, image_url, video_url, tags, available, track_stock, stock_qty,
            portion, components, spice_level, prep_minutes, allergens,
            name_en, description_en, portion_en, components_en, allergens_en, avail_days, avail_from, avail_to, pair_ids, opt1_name, opt2_name
     FROM menu_items WHERE tenant_id = ? AND archived = 0 ORDER BY sort, name`,
    tenant.id,
  );
  const [galleries, rules, variants] = await Promise.all([loadGalleries(c.var.db, tenant.id), loadPriceRules(c.var.db, tenant.id), loadItemVariants(c.var.db, tenant.id)]);
  const useStock = !!tenant.inventory_enabled;
  const locked = tenantLocked(tenant);
  return c.json({
    store: {
      name: tenant.name,
      kind: tenant.kind,
      address: tenant.address,
      phone: tenant.phone,
      logo_url: tenant.logo_url,
      welcome_note: tenant.welcome_note,
      welcome_note_en: tenant.welcome_note_en,
      tax_rate: tenant.tax_rate,
      service_rate: tenant.service_rate,
      accepting_orders: !!tenant.qr_ordering_enabled && !locked,
      theme: publicTheme(tenant),
    },
    mode: table ? "dine_in" : "takeaway",
    table: table ? { label: table.label, area: table.area } : null,
    // Koordinat toko tidak dikirim; pembeli cukup tahu apakah lokasinya akan dicek.
    geo: { check: geoActive(tenant), strict: geoActive(tenant) && tenant.geo_mode === "block" },
    // Harga promo & jadwal menu dihitung ulang di HP memakai jam toko (now + tz), dan sekali lagi di server saat pesanan masuk.
    pricing: { tz: tenant.tz_offset_minutes, now: Date.now(), rules: rules.map(({ id, name, percent, days, start_min, end_min, category_ids, active }) => ({ id, name, percent, days, start_min, end_min, category_ids, active })) },
    categories,
    items: (await attachPairs(c.var.db, tenant.id, items as (typeof items[number] & { category_id: string | null; pair_ids: string })[], (id) => {
      const x = items.find((i) => i.id === id);
      return !!x && !!x.available && !(useStock && !!x.track_stock && x.stock_qty <= 0);
    })).map(({ track_stock, stock_qty, pair_ids: _p, ...it }) => ({
      ...it,
      media: galleries.get(it.id) ?? [],
      // Pelanggan hanya perlu tahu "habis" atau "tinggal sedikit", bukan angka stok gudang.
      sold_out: !it.available || (useStock && !!track_stock && stock_qty <= 0),
      few_left: useStock && !!track_stock && stock_qty > 0 && stock_qty <= 3 ? stock_qty : null,
      // Varian: tanpa modal, barcode, dan angka stok; cukup harga dan status habis.
      variants: (variants.get(it.id) ?? []).map((v) => ({
        id: v.id,
        opt1: v.opt1,
        opt2: v.opt2,
        price: v.price,
        sold_out: !v.available || (useStock && !!track_stock && v.stock_qty <= 0),
      })),
    })),
  });
});

const orderSchema = (lang: Lang) => z.object({
  tableCode: z.string().min(4).max(40),
  customerName: z.string().trim().min(1, serverMsgs(lang).nameNeeded).max(40),
  note: z.string().trim().max(200).default(""),
  items: z
    .array(z.object({ id: z.string().min(1).max(64), variantId: z.string().max(64).nullable().optional(), qty: z.number().int().min(1).max(50), note: z.string().trim().max(120).optional() }))
    .max(40, "Pesanan terlalu banyak untuk sekali kirim.")
    .default([]),
  // Pesan bareng: isi pesanan diambil dari keranjang meja di server, bukan dari HP pengirim.
  group: z.boolean().optional(),
  loc: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), acc: z.number().min(0).max(100000) }).nullable().optional(),
});

const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${m} m`);

publicRoutes.post("/orders", async (c) => {
  const raw = await c.req.json();
  const lang = pickLang(raw?.lang);
  const M = serverMsgs(lang);
  const b = orderSchema(lang).parse(raw);
  const { table, tenant } = await resolveCode(c, b.tableCode, lang);
  if (tenantLocked(tenant) || !tenant.qr_ordering_enabled) fail(403, M.notAccepting);
  // Pengaman lokasi: menolak (mode block) atau menandai (mode flag) pesanan dari luar toko.
  const geo = checkGeo(tenant, b.loc);
  if (tenant.geo_mode === "block") {
    if (geo.check === "unknown") fail(403, M.locationNeeded);
    if (geo.check === "far") fail(403, M.tooFar(km(geo.distance!)));
  }
  // Pesan bareng: ambil semua pilihan orang-orang di meja ini.
  let lines: { id: string; variantId?: string | null; qty: number; note?: string; person?: string }[] = b.items;
  let cartIds: string[] = [];
  let customerName = b.customerName;
  if (b.group) {
    if (!table) fail(400, M.tableOnly);
    const cart = await loadCart(c.var.db, table.id);
    if (cart.length === 0) fail(400, M.cartEmpty);
    cartIds = cart.map((l) => l.id);
    lines = cart.map((l) => ({ id: l.menu_item_id, variantId: l.variant_id, qty: l.qty, note: l.note, person: l.person || customerName }));
    if (lines.reduce((n, i) => n + i.qty, 0) > 80) fail(400, M.tooManyItemsGroup);
    // Nama pengirim di depan, supaya pelayan tahu siapa yang menekan kirim.
    const names = [...new Set([customerName, ...lines.map((l) => l.person!)].filter(Boolean))];
    if (names.length > 1) customerName = names.join(", ").length <= 40 ? names.join(", ") : `${names[0]} +${names.length - 1}`;
  } else {
    if (lines.length === 0) fail(400, M.cartEmpty);
    // Batas anti-iseng dari QR yang difoto orang: jumlah item per pesanan dan pesanan berjalan per jam.
    if (lines.reduce((n, i) => n + i.qty, 0) > 30) fail(400, M.tooManyItems);
  }
  const hourAgo = Date.now() - 3600_000;
  if (table) {
    const open = await first<{ n: number }>(
      c.var.db,
      "SELECT COUNT(*) AS n FROM orders WHERE table_id = ? AND source = 'qr' AND status IN ('new','preparing') AND created_at > ?",
      table.id,
      hourAgo,
    );
    if ((open?.n ?? 0) >= 6) fail(429, M.tooManyOrders);
  } else {
    const open = await first<{ n: number }>(
      c.var.db,
      "SELECT COUNT(*) AS n FROM orders WHERE tenant_id = ? AND table_id IS NULL AND source = 'qr' AND status = 'new' AND created_at > ?",
      tenant.id,
      hourAgo,
    );
    if ((open?.n ?? 0) >= 15) fail(429, M.takeawayBusy);
  }
  const order = await createOrder(c.var.db, {
    tenant,
    source: "qr",
    orderType: table ? "dine_in" : "takeaway",
    tableId: table?.id ?? null,
    tableLabel: table?.label ?? null,
    geo,
    customerName,
    note: b.note,
    lines,
    userId: null,
    lang,
  });
  // Yang sudah terkirim dihapus. Pilihan yang ditambahkan orang lain setelah dibaca tetap tinggal untuk pesanan berikutnya.
  if (cartIds.length) await run(c.var.db, `DELETE FROM table_cart_lines WHERE id IN (${cartIds.map(() => "?").join(",")})`, ...cartIds);
  return c.json({ token: order.token, number: order.number }, 201);
});

// Status pesanan untuk pelanggan (pakai token acak, bukan ID).
publicRoutes.get("/orders/:token", async (c) => {
  const o = await first<Record<string, unknown> & { id: string; tenant_id: string }>(
    c.var.db,
    `SELECT o.id, o.tenant_id, o.tenant_id AS tid, o.number, o.table_label, o.customer_name, o.status, o.payment_status, o.subtotal, o.tax, o.service,
            o.total, o.note, o.created_at, o.cancel_reason, o.order_type, o.payment_method, o.paid_at, o.member_id, o.source,
            t.name AS store_name, t.address AS store_address,
            COALESCE(dt.code, CASE WHEN o.source = 'qr' AND o.table_id IS NULL AND t.takeaway_qr_enabled = 1 THEN t.takeaway_code END) AS table_code
     FROM orders o JOIN tenants t ON t.id = o.tenant_id LEFT JOIN dining_tables dt ON dt.id = o.table_id
     WHERE o.public_token = ?`,
    c.req.param("token"),
  );
  if (!o) fail(404, serverMsgs(pickLang(c.req.query("lang"))).orderMissing);
  const items = ((await loadOrderItems(c.var.db, [o.id])).get(o.id) ?? []) as { menu_item_id: string | null }[];
  const ids = items.map((i) => i.menu_item_id).filter(Boolean) as string[];
  const enNames = ids.length
    ? new Map((await all<{ id: string; name_en: string }>(c.var.db, `SELECT id, name_en FROM menu_items WHERE id IN (${ids.map(() => "?").join(",")})`, ...ids)).map((r) => [r.id, r.name_en]))
    : new Map<string, string>();
  const itemsOut = items.map((i) => ({ ...i, name_en: (i.menu_item_id && enNames.get(i.menu_item_id)) || "" }));
  const tenant = await first<Tenant>(c.var.db, `${TENANT_SELECT} WHERE t.id = ?`, o.tenant_id);
  const fb = await first<{ rating: number }>(c.var.db, "SELECT rating FROM order_feedback WHERE order_id = ?", o.id);
  let card = null;
  if (tenant?.loyalty_enabled && o.member_id) {
    const m = await first<{ phone: string }>(c.var.db, "SELECT phone FROM loyalty_members WHERE id = ?", o.member_id);
    if (m) card = await memberCard(c.var.db, tenant, m.phone);
  }
  const eta = tenant ? await orderEta(c.var.db, tenant, o.id, String(o.status)) : null;
  const { id: _id, tenant_id: _t, tid: _tid, member_id: _m, ...rest } = o;
  return c.json({
    order: { ...rest, items: itemsOut },
    eta,
    theme: tenant ? publicTheme(tenant) : DEFAULT_THEME,
    feedback: { sent: !!fb, rating: fb?.rating ?? null, review_url: tenant?.google_review_url || null },
    loyalty: tenant?.loyalty_enabled
      ? { target: tenant.loyalty_target, reward: tenant.loyalty_reward, min_spend: tenant.loyalty_min_spend, card: card ? { stamps: card.stamps, ready: card.ready } : null }
      : null,
  });
});

// ---------- Meja bersama: keranjang pesan bareng + panggil pelayan ----------

const CART_TTL = 3 * 3600_000;
type CartRow = { id: string; device: string; person: string; menu_item_id: string; variant_id: string | null; qty: number; note: string; updated_at: number };

async function loadCart(db: Env["Variables"]["db"], tableId: string) {
  return all<CartRow>(
    db,
    "SELECT id, device, person, menu_item_id, variant_id, qty, note, updated_at FROM table_cart_lines WHERE table_id = ? AND updated_at > ? ORDER BY updated_at, id",
    tableId,
    Date.now() - CART_TTL,
  );
}

const deviceId = z.string().regex(/^[a-z0-9]{8,40}$/i);

/**
 * Keadaan meja untuk semua HP yang memindai QR yang sama: isi keranjang bersama,
 * pesanan yang sedang berjalan, dan panggilan pelayan yang belum ditanggapi.
 * Satu permintaan ini yang di-poll, supaya hemat kuota dan server.
 */
publicRoutes.get("/table/:code/state", async (c) => {
  const lang = pickLang(c.req.query("lang"));
  const { table } = await resolveCode(c, c.req.param("code"), lang);
  if (!table) fail(400, serverMsgs(lang).tableOnly);
  const me = deviceId.safeParse(c.req.query("device")).data ?? "";
  const [cart, orders, calls, bill] = await Promise.all([
    loadCart(c.var.db, table.id),
    all<{ public_token: string; number: number; customer_name: string; status: string; created_at: number }>(
      c.var.db,
      `SELECT public_token, number, customer_name, status, created_at FROM orders
       WHERE table_id = ? AND source = 'qr' AND created_at > ? AND status IN ('new','preparing','ready') ORDER BY created_at DESC LIMIT 5`,
      table.id,
      Date.now() - CART_TTL,
    ),
    all<{ kind: string; created_at: number }>(c.var.db, "SELECT kind, created_at FROM service_calls WHERE table_id = ? AND status = 'open'", table.id),
    // Tagihan meja: semua pesanan meja ini (QR maupun kasir) yang belum dibayar dalam 12 jam terakhir.
    all<{ name: string; qty: number; amount: number; total: number; orders: number }>(
      c.var.db,
      `SELECT CASE WHEN i.variant_name != '' THEN i.name || ' (' || i.variant_name || ')' ELSE i.name END AS name,
              SUM(i.qty) AS qty, SUM(i.qty * i.price) AS amount
       FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.table_id = ? AND o.payment_status = 'unpaid' AND o.status != 'cancelled' AND o.created_at > ?
       GROUP BY 1 ORDER BY MIN(o.created_at)`,
      table.id,
      Date.now() - 12 * 3600_000,
    ),
  ]);
  const billTotal = bill.length
    ? await first<{ total: number; n: number }>(c.var.db, "SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS n FROM orders WHERE table_id = ? AND payment_status = 'unpaid' AND status != 'cancelled' AND created_at > ?", table.id, Date.now() - 12 * 3600_000)
    : null;
  return c.json({
    lines: cart.map((l) => ({ id: l.id, item_id: l.menu_item_id, variant_id: l.variant_id, qty: l.qty, note: l.note, person: l.person, mine: l.device === me })),
    people: new Set(cart.map((l) => l.device)).size,
    orders: orders.map((o) => ({ token: o.public_token, number: o.number, name: o.customer_name, status: o.status, at: o.created_at })),
    calls,
    bill: billTotal && billTotal.n ? { orders: billTotal.n, total: billTotal.total, items: bill.map(({ name, qty, amount }) => ({ name, qty, amount })) } : null,
  });
});

// Ganti semua pilihan milik satu HP di keranjang meja.
publicRoutes.put("/table/:code/cart", async (c) => {
  const raw = await c.req.json();
  const lang = pickLang(raw?.lang);
  const M = serverMsgs(lang);
  const b = z
    .object({
      device: deviceId,
      person: z.string().trim().max(30).default(""),
      lines: z.array(z.object({ id: z.string().min(1).max(64), variantId: z.string().max(64).nullable().optional(), qty: z.number().int().min(1).max(50), note: z.string().trim().max(120).default("") })).max(30),
    })
    .parse(raw);
  const { table, tenant } = await resolveCode(c, c.req.param("code"), lang);
  if (!table) fail(400, M.tableOnly);
  if (b.lines.reduce((n, l) => n + l.qty, 0) > 30) fail(400, M.tooManyItems);
  const now = Date.now();
  const cart = await loadCart(c.var.db, table.id);
  const others = new Set(cart.filter((l) => l.device !== b.device).map((l) => l.device));
  if (b.lines.length && others.size >= 12) fail(429, M.tableCartFull);
  // Hanya menu milik toko ini yang boleh masuk.
  const ids = [...new Set(b.lines.map((l) => l.id))];
  const valid = ids.length
    ? new Set((await all<{ id: string }>(c.var.db, `SELECT id FROM menu_items WHERE tenant_id = ? AND archived = 0 AND id IN (${ids.map(() => "?").join(",")})`, tenant.id, ...ids)).map((r) => r.id))
    : new Set<string>();
  const db = c.var.db;
  await db.batch([
    stmt(db, "DELETE FROM table_cart_lines WHERE table_id = ? AND (device = ? OR updated_at <= ?)", table.id, b.device, now - CART_TTL),
    ...b.lines
      .filter((l) => valid.has(l.id))
      .map((l) =>
        stmt(db, "INSERT INTO table_cart_lines (id, tenant_id, table_id, device, person, menu_item_id, variant_id, qty, note, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          newId(), tenant.id, table.id, b.device, b.person, l.id, l.variantId ?? null, l.qty, l.note, now),
      ),
  ]);
  return c.json({ ok: true });
});

// Siapa pun di meja boleh menghapus satu baris (mis. pilihan yang tidak jadi, atau isian orang iseng).
publicRoutes.delete("/table/:code/cart/:lineId", async (c) => {
  const { table } = await resolveCode(c, c.req.param("code"));
  if (!table) fail(400, serverMsgs("id").tableOnly);
  await run(c.var.db, "DELETE FROM table_cart_lines WHERE id = ? AND table_id = ?", c.req.param("lineId"), table.id);
  return c.json({ ok: true });
});

const callSchema = z.object({
  kind: z.enum(["waiter", "bill"]),
  lang: z.string().optional(),
  loc: z.object({ lat: z.number(), lng: z.number(), acc: z.number().min(0) }).nullable().optional(),
});

publicRoutes.post("/table/:code/calls", async (c) => {
  const b = callSchema.parse(await c.req.json());
  const lang = pickLang(b.lang);
  const M = serverMsgs(lang);
  const { table, tenant } = await resolveCode(c, c.req.param("code"), lang);
  if (!table) fail(400, M.tableOnly);
  if (tenantLocked(tenant)) fail(403, M.notAccepting);
  const geo = checkGeo(tenant, b.loc);
  if (tenant.geo_mode === "block") {
    if (geo.check === "unknown") fail(403, M.locationNeeded);
    if (geo.check === "far") fail(403, M.tooFar(km(geo.distance!)));
  }
  // Panggilan yang sama dan belum ditanggapi tidak digandakan; kasir cukup melihat satu.
  const open = await first<{ id: string }>(c.var.db, "SELECT id FROM service_calls WHERE table_id = ? AND kind = ? AND status = 'open'", table.id, b.kind);
  if (open) return c.json({ ok: true, id: open.id });
  const recent = await first<{ n: number }>(c.var.db, "SELECT COUNT(*) AS n FROM service_calls WHERE table_id = ? AND created_at > ?", table.id, Date.now() - 3600_000);
  if ((recent?.n ?? 0) >= 10) fail(429, M.tooManyCalls);
  const id = newId();
  await run(
    c.var.db,
    "INSERT INTO service_calls (id, tenant_id, table_id, table_label, kind, geo_check, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    id, tenant.id, table.id, table.label, b.kind, geo.check, Date.now(),
  );
  return c.json({ ok: true, id }, 201);
});

publicRoutes.delete("/table/:code/calls/:kind", async (c) => {
  const { table } = await resolveCode(c, c.req.param("code"));
  if (!table) fail(400, serverMsgs("id").tableOnly);
  await run(c.var.db, "UPDATE service_calls SET status = 'cancelled', done_at = ? WHERE table_id = ? AND kind = ? AND status = 'open'", Date.now(), table.id, c.req.param("kind"));
  return c.json({ ok: true });
});


// ---------- Ulasan pembeli ----------

const FEEDBACK_DAYS = 7;
const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).default(""),
  items: z.array(z.object({ id: z.string().min(1).max(64), liked: z.boolean() })).max(40).default([]),
  lang: z.string().optional(),
});

type TokenOrder = { id: string; tenant_id: string; status: string; payment_status: string; created_at: number; paid_at: number | null; total: number; member_id: string | null; customer_name: string };
async function orderByToken(c: { var: Env["Variables"] }, token: string, lang: Lang) {
  const o = await first<TokenOrder>(c.var.db, "SELECT id, tenant_id, status, payment_status, created_at, paid_at, total, member_id, customer_name FROM orders WHERE public_token = ?", token);
  if (!o) fail(404, serverMsgs(lang).orderMissing);
  const tenant = await first<Tenant>(c.var.db, `${TENANT_SELECT} WHERE t.id = ?`, o.tenant_id);
  if (!tenant) fail(404, serverMsgs(lang).storeMissing);
  return { o, tenant };
}

publicRoutes.post("/orders/:token/feedback", async (c) => {
  const b = feedbackSchema.parse(await c.req.json());
  const lang = pickLang(b.lang);
  const M = serverMsgs(lang);
  const { o, tenant } = await orderByToken(c, c.req.param("token"), lang);
  if (o.status === "cancelled" || !(o.status === "done" || o.status === "ready" || o.payment_status === "paid")) fail(409, M.feedbackTooEarly);
  if (Date.now() - o.created_at > FEEDBACK_DAYS * 86400_000) fail(409, M.feedbackTooLate);
  if (await first(c.var.db, "SELECT 1 FROM order_feedback WHERE order_id = ?", o.id)) fail(409, M.feedbackDone);
  // Hanya menu yang memang ada di pesanan ini yang bisa dinilai.
  const inOrder = new Set((await all<{ menu_item_id: string }>(c.var.db, "SELECT DISTINCT menu_item_id FROM order_items WHERE order_id = ? AND menu_item_id IS NOT NULL", o.id)).map((r) => r.menu_item_id));
  const now = Date.now();
  const db = c.var.db;
  try {
    await db.batch([
      stmt(db, "INSERT INTO order_feedback (id, tenant_id, order_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)", newId(), tenant.id, o.id, b.rating, b.comment, now),
      ...[...new Map(b.items.filter((i) => inOrder.has(i.id)).map((i) => [i.id, i])).values()].map((i) =>
        stmt(db, "INSERT INTO item_feedback (id, tenant_id, order_id, menu_item_id, liked, created_at) VALUES (?, ?, ?, ?, ?, ?)", newId(), tenant.id, o.id, i.id, i.liked ? 1 : 0, now),
      ),
    ]);
  } catch (e) {
    if (String(e).includes("UNIQUE")) fail(409, M.feedbackDone);
    throw e;
  }
  // Tautan ulasan Google ditampilkan ke semua pembeli, apa pun nilainya: Google melarang hanya meminta ulasan dari yang puas.
  return c.json({ ok: true, review_url: tenant.google_review_url || null }, 201);
});

// ---------- Kartu stempel untuk pesanan QR ----------

publicRoutes.post("/orders/:token/stamp", async (c) => {
  const b = z.object({ phone: z.string().max(30), lang: z.string().optional() }).parse(await c.req.json());
  const lang = pickLang(b.lang);
  const M = serverMsgs(lang);
  const { o, tenant } = await orderByToken(c, c.req.param("token"), lang);
  if (!tenant.loyalty_enabled) fail(409, M.loyaltyOff);
  const phone = normalizePhone(b.phone);
  if (!phone) fail(400, M.phoneInvalid);
  if (o.payment_status !== "paid" || o.status === "cancelled") fail(409, M.stampNotYet);
  if (Date.now() - (o.paid_at ?? o.created_at) > 24 * 3600_000) fail(409, M.stampExpired);
  if (o.member_id) fail(409, M.stampTaken);
  if (o.total < tenant.loyalty_min_spend) fail(409, M.stampMinSpend(`Rp${new Intl.NumberFormat("id-ID").format(tenant.loyalty_min_spend)}`));
  const r = await awardStamp(c.var.db, tenant, o.id, phone, o.customer_name, null);
  if (!r || !r.stamped) fail(409, M.stampTaken);
  return c.json({ card: { stamps: r.card.stamps, ready: r.card.ready } });
});

// ---------- Antrean tunggu ----------

type WaitRow = { id: string; number: number; name: string; party_size: number; status: string; token: string; table_label: string | null; created_at: number; called_at: number | null; tenant_id: string; business_day: string };

async function waitlistTenant(c: { var: Env["Variables"] }, code: string, lang: Lang) {
  const tenant = await first<Tenant>(c.var.db, `${TENANT_SELECT} WHERE t.waitlist_code = ?`, code);
  if (!tenant) fail(404, serverMsgs(lang).tableUnknown);
  return tenant;
}

async function waitingAhead(db: Env["Variables"]["db"], w: WaitRow) {
  const r = await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM waitlist WHERE tenant_id = ? AND business_day = ? AND status = 'waiting' AND created_at < ?", w.tenant_id, w.business_day, w.created_at);
  return r?.n ?? 0;
}

publicRoutes.get("/waitlist/:code", async (c) => {
  const lang = pickLang(c.req.query("lang"));
  const t = await waitlistTenant(c, c.req.param("code"), lang);
  const day = businessDay(Date.now(), t.tz_offset_minutes);
  const r = await first<{ n: number }>(c.var.db, "SELECT COUNT(*) AS n FROM waitlist WHERE tenant_id = ? AND business_day = ? AND status = 'waiting'", t.id, day);
  return c.json({
    store: { name: t.name, logo_url: t.logo_url, theme: publicTheme(t) },
    open: !!t.waitlist_enabled && !tenantLocked(t),
    waiting: r?.n ?? 0,
    geo: { check: geoActive(t), strict: geoActive(t) && t.geo_mode === "block" },
  });
});

const joinSchema = z.object({
  name: z.string().trim().min(1).max(40),
  party: z.number().int().min(1).max(50),
  phone: z.string().trim().max(30).default(""),
  lang: z.string().optional(),
  loc: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), acc: z.number().min(0).max(100000) }).nullable().optional(),
});

publicRoutes.post("/waitlist/:code", async (c) => {
  const raw = await c.req.json();
  const lang = pickLang(raw?.lang);
  const M = serverMsgs(lang);
  const b = joinSchema.parse(raw);
  const t = await waitlistTenant(c, c.req.param("code"), lang);
  if (!t.waitlist_enabled || tenantLocked(t)) fail(403, M.waitlistOff);
  const geo = checkGeo(t, b.loc);
  if (t.geo_mode === "block") {
    if (geo.check === "unknown") fail(403, M.locationNeeded);
    if (geo.check === "far") fail(403, M.tooFar(km(geo.distance!)));
  }
  const phone = b.phone ? normalizePhone(b.phone) : "";
  if (phone === null) fail(400, M.phoneInvalid);
  const entry = await addToWaitlist(c.var.db, t, { name: b.name, party: b.party, phone, source: "qr" });
  if (!entry) fail(429, M.waitlistFull);
  return c.json(entry, 201);
});

/** Dipakai QR pintu dan kasir. Null kalau antrean hari ini sudah terlalu panjang. */
export async function addToWaitlist(db: Env["Variables"]["db"], t: Tenant, e: { name: string; party: number; phone: string; source: "qr" | "kasir"; note?: string }) {
  const now = Date.now();
  const day = businessDay(now, t.tz_offset_minutes);
  const open = await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM waitlist WHERE tenant_id = ? AND business_day = ? AND status IN ('waiting','called')", t.id, day);
  if ((open?.n ?? 0) >= 60) return null;
  const token = randomToken(12);
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await first<{ n: number | null }>(db, "SELECT MAX(number) AS n FROM waitlist WHERE tenant_id = ? AND business_day = ?", t.id, day);
    const number = (row?.n ?? 0) + 1;
    try {
      await run(
        db,
        "INSERT INTO waitlist (id, tenant_id, number, business_day, name, party_size, phone, note, source, token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        newId(), t.id, number, day, e.name, e.party, e.phone, e.note ?? "", e.source, token, now,
      );
      return { token, number };
    } catch (err) {
      if (String(err).includes("UNIQUE") && attempt < 4) continue;
      throw err;
    }
  }
  return null;
}

publicRoutes.get("/waitlist/entry/:token", async (c) => {
  const lang = pickLang(c.req.query("lang"));
  const w = await first<WaitRow>(c.var.db, "SELECT * FROM waitlist WHERE token = ?", c.req.param("token"));
  if (!w) fail(404, serverMsgs(lang).waitlistMissing);
  const t = await first<Tenant>(c.var.db, `${TENANT_SELECT} WHERE t.id = ?`, w.tenant_id);
  return c.json({
    entry: { number: w.number, name: w.name, party: w.party_size, status: w.status, table_label: w.table_label, created_at: w.created_at, called_at: w.called_at },
    ahead: w.status === "waiting" ? await waitingAhead(c.var.db, w) : 0,
    store: { name: t?.name ?? "", theme: t ? publicTheme(t) : DEFAULT_THEME, code: t?.waitlist_code ?? null },
  });
});

publicRoutes.delete("/waitlist/entry/:token", async (c) => {
  await run(c.var.db, "UPDATE waitlist SET status = 'cancelled', done_at = ? WHERE token = ? AND status IN ('waiting','called')", Date.now(), c.req.param("token"));
  return c.json({ ok: true });
});

// ---------- Konten situs (landing, halaman solusi, footer) ----------
publicRoutes.get("/site", async (c) => {
  c.header("Cache-Control", "public, max-age=30");
  return c.json({ site: publicSite(await loadSite(c.var.db)) });
});
