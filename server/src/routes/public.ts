import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../app";
import { all, first } from "../db/types";
import { TENANT_SELECT, tenantLocked, type Tenant } from "../lib/auth";
import { fail } from "../lib/http";
import { createOrder, loadOrderItems } from "../lib/orders";
import { loadGalleries } from "../lib/gallery";
import { checkGeo, geoActive } from "../lib/geo";
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
            name_en, description_en, portion_en, components_en, allergens_en
     FROM menu_items WHERE tenant_id = ? AND archived = 0 ORDER BY sort, name`,
    tenant.id,
  );
  const galleries = await loadGalleries(c.var.db, tenant.id);
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
    categories,
    items: items.map(({ track_stock, stock_qty, ...it }) => ({
      ...it,
      media: galleries.get(it.id) ?? [],
      // Pelanggan hanya perlu tahu "habis" atau "tinggal sedikit", bukan angka stok gudang.
      sold_out: !it.available || (useStock && !!track_stock && stock_qty <= 0),
      few_left: useStock && !!track_stock && stock_qty > 0 && stock_qty <= 3 ? stock_qty : null,
    })),
  });
});

const orderSchema = (lang: Lang) => z.object({
  tableCode: z.string().min(4).max(40),
  customerName: z.string().trim().min(1, serverMsgs(lang).nameNeeded).max(40),
  note: z.string().trim().max(200).default(""),
  items: z
    .array(z.object({ id: z.string().min(1).max(64), qty: z.number().int().min(1).max(50), note: z.string().trim().max(120).optional() }))
    .min(1, serverMsgs(lang).cartEmpty)
    .max(40, "Pesanan terlalu banyak untuk sekali kirim."),
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
  // Batas anti-iseng dari QR yang difoto orang: jumlah item per pesanan dan pesanan berjalan per jam.
  const totalQty = b.items.reduce((n, i) => n + i.qty, 0);
  if (totalQty > 30) fail(400, M.tooManyItems);
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
    customerName: b.customerName,
    note: b.note,
    lines: b.items,
    userId: null,
    lang,
  });
  return c.json({ token: order.token, number: order.number }, 201);
});

// Status pesanan untuk pelanggan (pakai token acak, bukan ID).
publicRoutes.get("/orders/:token", async (c) => {
  const o = await first<Record<string, unknown> & { id: string; tenant_id: string }>(
    c.var.db,
    `SELECT o.id, o.tenant_id, o.tenant_id AS tid, o.number, o.table_label, o.customer_name, o.status, o.payment_status, o.subtotal, o.tax, o.service,
            o.total, o.note, o.created_at, o.cancel_reason, o.order_type, t.name AS store_name,
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
  const { id: _id, tenant_id: _t, tid: _tid, ...rest } = o;
  return c.json({ order: { ...rest, items: itemsOut }, theme: tenant ? publicTheme(tenant) : DEFAULT_THEME });
});
