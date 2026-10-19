import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../app";
import { all, first } from "../db/types";
import { TENANT_SELECT, tenantLocked, type Tenant } from "../lib/auth";
import { fail } from "../lib/http";
import { createOrder, loadOrderItems } from "../lib/orders";
import { loadGalleries } from "../lib/gallery";
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

async function tenantByTable(c: { var: Env["Variables"] }, code: string, lang: Lang = "id") {
  const M = serverMsgs(lang);
  const table = await first<{ id: string; tenant_id: string; label: string; area: string; active: number }>(
    c.var.db,
    "SELECT id, tenant_id, label, area, active FROM dining_tables WHERE code = ?",
    code,
  );
  if (!table || !table.active) fail(404, M.tableUnknown);
  const tenant = await first<Tenant>(c.var.db, `${TENANT_SELECT} WHERE t.id = ?`, table.tenant_id);
  if (!tenant) fail(404, M.storeMissing);
  return { table, tenant };
}

// Menu untuk pelanggan yang memindai QR meja.
publicRoutes.get("/table/:code", async (c) => {
  const { table, tenant } = await tenantByTable(c, c.req.param("code"), pickLang(c.req.query("lang")));
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
    table: { label: table.label, area: table.area },
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
});

publicRoutes.post("/orders", async (c) => {
  const raw = await c.req.json();
  const lang = pickLang(raw?.lang);
  const M = serverMsgs(lang);
  const b = orderSchema(lang).parse(raw);
  const { table, tenant } = await tenantByTable(c, b.tableCode, lang);
  if (tenantLocked(tenant) || !tenant.qr_ordering_enabled) fail(403, M.notAccepting);
  // Batas anti-iseng dari QR yang difoto orang: jumlah item per pesanan dan pesanan per meja per jam.
  const totalQty = b.items.reduce((n, i) => n + i.qty, 0);
  if (totalQty > 30) fail(400, M.tooManyItems);
  const open = await first<{ n: number }>(
    c.var.db,
    "SELECT COUNT(*) AS n FROM orders WHERE table_id = ? AND source = 'qr' AND status IN ('new','preparing') AND created_at > ?",
    table.id,
    Date.now() - 3600_000,
  );
  if ((open?.n ?? 0) >= 6) fail(429, M.tooManyOrders);
  const order = await createOrder(c.var.db, {
    tenant,
    source: "qr",
    orderType: "dine_in",
    tableId: table.id,
    tableLabel: table.label,
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
            o.total, o.note, o.created_at, o.cancel_reason, t.name AS store_name, dt.code AS table_code
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
