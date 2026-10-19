import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../app";
import { all, first, run, stmt, type Stmt } from "../db/types";
import { ALL_STORE, MANAGEMENT, requireStore, storeOf, tenantLocked } from "../lib/auth";
import { fail } from "../lib/http";
import { createOrder, loadOrderItems, restockCancelledOrder } from "../lib/orders";
import { hashPassword, newId, randomCode } from "../lib/security";
import { EXT, MEDIA_LIMITS } from "../lib/storage";
import { analyticsRoutes } from "./analytics";

export const storeRoutes = new Hono<Env>();

storeRoutes.use("*", requireStore(ALL_STORE));
const mgmt = requireStore(MANAGEMENT);

const money = z.number().int("Harga harus angka bulat.").min(0, "Harga tidak boleh minus.").max(1_000_000_000);
const bool = z.union([z.boolean(), z.literal(0), z.literal(1)]).transform((v) => (v ? 1 : 0));

// ---------- Pengaturan toko ----------

storeRoutes.get("/settings", async (c) => c.json({ tenant: storeOf(c) }));

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  kind: z.enum(["resto", "kafe", "warung", "toko"]),
  address: z.string().trim().max(200),
  phone: z.string().trim().max(30),
  welcome_note: z.string().trim().max(240),
  tax_rate: z.number().min(0).max(30),
  service_rate: z.number().min(0).max(30),
  inventory_enabled: bool,
  qr_ordering_enabled: bool,
  logo_url: z.string().max(300).nullable(),
});

storeRoutes.put("/settings", mgmt, async (c) => {
  const t = storeOf(c);
  const b = settingsSchema.parse(await c.req.json());
  checkMediaUrl(t.id, b.logo_url);
  if (b.inventory_enabled && !t.allow_inventory) fail(403, `Fitur stok belum termasuk di paket ${t.plan_name}.`);
  await run(
    c.var.db,
    `UPDATE tenants SET name=?, kind=?, address=?, phone=?, welcome_note=?, tax_rate=?, service_rate=?,
       inventory_enabled=?, qr_ordering_enabled=?, logo_url=? WHERE id=?`,
    b.name, b.kind, b.address, b.phone, b.welcome_note, b.tax_rate, b.service_rate,
    b.inventory_enabled, b.qr_ordering_enabled, b.logo_url, t.id,
  );
  return c.json({ ok: true });
});

// ---------- Kategori ----------

storeRoutes.get("/categories", async (c) => {
  const t = storeOf(c);
  return c.json({
    categories: await all(
      c.var.db,
      `SELECT c.id, c.name, c.sort, (SELECT COUNT(*) FROM menu_items m WHERE m.category_id = c.id AND m.archived = 0) AS item_count
       FROM categories c WHERE c.tenant_id = ? ORDER BY c.sort, c.name`,
      t.id,
    ),
  });
});

const categorySchema = z.object({ name: z.string().trim().min(1, "Nama kategori wajib diisi.").max(40) });

storeRoutes.post("/categories", mgmt, async (c) => {
  const t = storeOf(c);
  const b = categorySchema.parse(await c.req.json());
  const max = await first<{ s: number | null }>(c.var.db, "SELECT MAX(sort) AS s FROM categories WHERE tenant_id = ?", t.id);
  const id = newId();
  await run(c.var.db, "INSERT INTO categories (id, tenant_id, name, sort, created_at) VALUES (?, ?, ?, ?, ?)", id, t.id, b.name, (max?.s ?? 0) + 1, Date.now());
  return c.json({ id }, 201);
});

storeRoutes.put("/categories/:id", mgmt, async (c) => {
  const t = storeOf(c);
  const b = categorySchema.parse(await c.req.json());
  const n = await run(c.var.db, "UPDATE categories SET name = ? WHERE id = ? AND tenant_id = ?", b.name, c.req.param("id"), t.id);
  if (!n) fail(404, "Kategori tidak ditemukan.");
  return c.json({ ok: true });
});

storeRoutes.post("/categories/reorder", mgmt, async (c) => {
  const t = storeOf(c);
  const b = z.object({ ids: z.array(z.string()).max(100) }).parse(await c.req.json());
  await c.var.db.batch(b.ids.map((id, i) => stmt(c.var.db, "UPDATE categories SET sort = ? WHERE id = ? AND tenant_id = ?", i + 1, id, t.id)));
  return c.json({ ok: true });
});

storeRoutes.delete("/categories/:id", mgmt, async (c) => {
  const t = storeOf(c);
  const n = await run(c.var.db, "DELETE FROM categories WHERE id = ? AND tenant_id = ?", c.req.param("id"), t.id);
  if (!n) fail(404, "Kategori tidak ditemukan.");
  return c.json({ ok: true });
});

// ---------- Menu / produk ----------

storeRoutes.get("/items", async (c) => {
  const t = storeOf(c);
  return c.json({
    items: await all(
      c.var.db,
      `SELECT id, category_id, name, description, price, image_url, video_url, tags, available, track_stock, stock_qty,
              low_stock_at, unit, sort
       FROM menu_items WHERE tenant_id = ? AND archived = 0 ORDER BY sort, name`,
      t.id,
    ),
  });
});

const itemSchema = z.object({
  category_id: z.string().nullable(),
  name: z.string().trim().min(1, "Nama menu wajib diisi.").max(80),
  description: z.string().trim().max(500).default(""),
  price: money,
  image_url: z.string().max(300).nullable().default(null),
  video_url: z.string().max(300).nullable().default(null),
  tags: z.string().trim().max(120).default(""),
  available: bool.default(1),
  track_stock: bool.default(0),
  low_stock_at: z.number().int().min(0).max(100000).default(5),
  unit: z.string().trim().min(1).max(20).default("porsi"),
});

async function checkCategory(c: { var: Env["Variables"] }, tenantId: string, categoryId: string | null) {
  if (!categoryId) return;
  if (!(await first(c.var.db, "SELECT 1 FROM categories WHERE id = ? AND tenant_id = ?", categoryId, tenantId))) {
    fail(400, "Kategori tidak ditemukan.");
  }
}

function checkMediaUrl(tenantId: string, url: string | null) {
  // Hanya media milik toko sendiri (persis format hasil unggah) yang boleh dipasang.
  if (!url) return;
  const ok = url.startsWith(`/media/${tenantId}/`) && /^\/media\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|gif|mp4|webm)$/.test(url);
  if (!ok) fail(400, "File media tidak valid. Unggah ulang.");
}

storeRoutes.post("/items", mgmt, async (c) => {
  const t = storeOf(c);
  const b = itemSchema.parse(await c.req.json());
  await checkCategory(c, t.id, b.category_id);
  checkMediaUrl(t.id, b.image_url);
  checkMediaUrl(t.id, b.video_url);
  if (b.video_url && !t.allow_video) fail(403, `Video menu belum termasuk di paket ${t.plan_name}.`);
  const max = await first<{ s: number | null }>(c.var.db, "SELECT MAX(sort) AS s FROM menu_items WHERE tenant_id = ?", t.id);
  const id = newId();
  await run(
    c.var.db,
    `INSERT INTO menu_items (id, tenant_id, category_id, name, description, price, image_url, video_url, tags, available,
       track_stock, low_stock_at, unit, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, t.id, b.category_id, b.name, b.description, b.price, b.image_url, b.video_url, b.tags, b.available,
    b.track_stock, b.low_stock_at, b.unit, (max?.s ?? 0) + 1, Date.now(),
  );
  return c.json({ id }, 201);
});

storeRoutes.put("/items/:id", mgmt, async (c) => {
  const t = storeOf(c);
  const b = itemSchema.parse(await c.req.json());
  await checkCategory(c, t.id, b.category_id);
  checkMediaUrl(t.id, b.image_url);
  checkMediaUrl(t.id, b.video_url);
  if (b.video_url && !t.allow_video) fail(403, `Video menu belum termasuk di paket ${t.plan_name}.`);
  const n = await run(
    c.var.db,
    `UPDATE menu_items SET category_id=?, name=?, description=?, price=?, image_url=?, video_url=?, tags=?, available=?,
       track_stock=?, low_stock_at=?, unit=? WHERE id=? AND tenant_id=? AND archived = 0`,
    b.category_id, b.name, b.description, b.price, b.image_url, b.video_url, b.tags, b.available,
    b.track_stock, b.low_stock_at, b.unit, c.req.param("id"), t.id,
  );
  if (!n) fail(404, "Menu tidak ditemukan.");
  return c.json({ ok: true });
});

// Karyawan juga boleh menandai menu habis/tersedia, karena merekalah yang tahu di dapur.
storeRoutes.patch("/items/:id/availability", async (c) => {
  const t = storeOf(c);
  const b = z.object({ available: bool }).parse(await c.req.json());
  const n = await run(c.var.db, "UPDATE menu_items SET available = ? WHERE id = ? AND tenant_id = ?", b.available, c.req.param("id"), t.id);
  if (!n) fail(404, "Menu tidak ditemukan.");
  return c.json({ ok: true });
});

storeRoutes.delete("/items/:id", mgmt, async (c) => {
  const t = storeOf(c);
  // Diarsipkan, bukan dihapus, supaya riwayat penjualan tetap utuh.
  const n = await run(c.var.db, "UPDATE menu_items SET archived = 1 WHERE id = ? AND tenant_id = ?", c.req.param("id"), t.id);
  if (!n) fail(404, "Menu tidak ditemukan.");
  return c.json({ ok: true });
});

storeRoutes.post("/items/reorder", mgmt, async (c) => {
  const t = storeOf(c);
  const b = z.object({ ids: z.array(z.string()).max(500) }).parse(await c.req.json());
  await c.var.db.batch(b.ids.map((id, i) => stmt(c.var.db, "UPDATE menu_items SET sort = ? WHERE id = ? AND tenant_id = ?", i + 1, id, t.id)));
  return c.json({ ok: true });
});

// ---------- Unggah media ----------

storeRoutes.post("/media", mgmt, async (c) => {
  const t = storeOf(c);
  // Tolak lebih awal sebelum seluruh file dibaca ke memori.
  if (Number(c.req.header("content-length") ?? 0) > MEDIA_LIMITS.video.maxBytes + 64 * 1024) fail(413, "Ukuran file terlalu besar.");
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) fail(400, "Pilih file dulu.");
  const kind = file.type.startsWith("video/") ? "video" : "image";
  const limit = MEDIA_LIMITS[kind];
  if (!(limit.types as readonly string[]).includes(file.type)) {
    fail(415, kind === "video" ? "Video harus MP4 atau WebM." : "Gambar harus JPG, PNG, WebP, atau GIF.");
  }
  if (kind === "video" && !t.allow_video) fail(403, `Video menu belum termasuk di paket ${t.plan_name}.`);
  if (file.size > limit.maxBytes) {
    fail(413, `Ukuran file maksimal ${Math.round(limit.maxBytes / 1024 / 1024)} MB.`);
  }
  const key = `${t.id}/${newId()}.${EXT[file.type]}`;
  await c.var.storage.put(key, await file.arrayBuffer(), file.type);
  return c.json({ url: `/media/${key}`, kind }, 201);
});

// ---------- Meja & QR ----------

storeRoutes.get("/tables", async (c) => {
  const t = storeOf(c);
  return c.json({
    tables: await all(
      c.var.db,
      `SELECT d.id, d.label, d.code, d.area, d.active,
         (SELECT COUNT(*) FROM orders o WHERE o.table_id = d.id AND o.status IN ('new','preparing','ready')) AS open_orders
       FROM dining_tables d WHERE d.tenant_id = ? ORDER BY d.area, d.label`,
      t.id,
    ),
  });
});

const tableSchema = z.object({
  label: z.string().trim().min(1, "Nama meja wajib diisi.").max(30),
  area: z.string().trim().max(30).default(""),
  active: bool.default(1),
});

storeRoutes.post("/tables", mgmt, async (c) => {
  const t = storeOf(c);
  const body = await c.req.json();
  // Bisa tambah satu meja, atau banyak sekaligus: { prefix: "Meja", from: 1, to: 10, area }
  const bulk = z.object({ prefix: z.string().trim().min(1).max(20), from: z.number().int().min(0), to: z.number().int().min(0), area: z.string().trim().max(30).default("") }).safeParse(body);
  const labels = bulk.success
    ? Array.from({ length: Math.max(0, bulk.data.to - bulk.data.from + 1) }, (_, i) => `${bulk.data.prefix} ${bulk.data.from + i}`)
    : [tableSchema.parse(body).label];
  const area = bulk.success ? bulk.data.area : tableSchema.parse(body).area;
  if (labels.length === 0 || labels.length > 100) fail(400, "Rentang nomor meja tidak valid (maksimal 100 sekali tambah).");
  const count = await first<{ n: number }>(c.var.db, "SELECT COUNT(*) AS n FROM dining_tables WHERE tenant_id = ?", t.id);
  if ((count?.n ?? 0) + labels.length > t.max_tables) {
    fail(403, `Paket ${t.plan_name} maksimal ${t.max_tables} meja. Saat ini sudah ${count?.n ?? 0}.`);
  }
  const now = Date.now();
  await c.var.db.batch(
    labels.map((label) =>
      stmt(c.var.db, "INSERT INTO dining_tables (id, tenant_id, label, code, area, created_at) VALUES (?, ?, ?, ?, ?, ?)", newId(), t.id, label, randomCode(10), area, now),
    ),
  );
  return c.json({ created: labels.length }, 201);
});

storeRoutes.put("/tables/:id", mgmt, async (c) => {
  const t = storeOf(c);
  const b = tableSchema.parse(await c.req.json());
  const n = await run(c.var.db, "UPDATE dining_tables SET label = ?, area = ?, active = ? WHERE id = ? AND tenant_id = ?", b.label, b.area, b.active, c.req.param("id"), t.id);
  if (!n) fail(404, "Meja tidak ditemukan.");
  return c.json({ ok: true });
});

// Ganti kode QR kalau QR lama tersebar/difoto orang dan disalahgunakan.
storeRoutes.post("/tables/:id/regenerate", mgmt, async (c) => {
  const t = storeOf(c);
  const n = await run(c.var.db, "UPDATE dining_tables SET code = ? WHERE id = ? AND tenant_id = ?", randomCode(10), c.req.param("id"), t.id);
  if (!n) fail(404, "Meja tidak ditemukan.");
  return c.json({ ok: true });
});

storeRoutes.delete("/tables/:id", mgmt, async (c) => {
  const t = storeOf(c);
  const n = await run(c.var.db, "DELETE FROM dining_tables WHERE id = ? AND tenant_id = ?", c.req.param("id"), t.id);
  if (!n) fail(404, "Meja tidak ditemukan.");
  return c.json({ ok: true });
});

// ---------- Pesanan ----------


storeRoutes.get("/orders", async (c) => {
  const t = storeOf(c);
  const scope = c.req.query("scope") ?? "active"; // active | today | history
  const where: string[] = ["o.tenant_id = ?"];
  const args: unknown[] = [t.id];
  if (scope === "active") {
    // Aktif = masih diproses, atau sudah diantar tapi belum dibayar.
    where.push(`(o.status IN ('new','preparing','ready') OR (o.status = 'done' AND o.payment_status = 'unpaid'))`);
  } else {
    const day = c.req.query("day");
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
      where.push("o.business_day = ?");
      args.push(day);
    }
    const q = c.req.query("q")?.trim();
    if (q) {
      where.push("(o.customer_name LIKE ? OR o.table_label LIKE ? OR CAST(o.number AS TEXT) = ?)");
      args.push(`%${q}%`, `%${q}%`, q);
    }
  }
  const limit = scope === "active" ? 100 : 80;
  const orders = await all<{ id: string } & Record<string, unknown>>(
    c.var.db,
    `SELECT o.id, o.number, o.business_day, o.table_label, o.source, o.order_type, o.customer_name, o.status, o.payment_status,
            o.payment_method, o.amount_received, o.subtotal, o.tax, o.service, o.total, o.note, o.cancel_reason, o.created_at,
            o.updated_at, o.paid_at, u.name AS created_by_name
     FROM orders o LEFT JOIN users u ON u.id = o.created_by
     WHERE ${where.join(" AND ")} ORDER BY o.created_at DESC LIMIT ${limit}`,
    ...args,
  );
  const items = await loadOrderItems(c.var.db, orders.map((o) => o.id));
  return c.json({ orders: orders.map((o) => ({ ...o, items: items.get(o.id) ?? [] })) });
});

const posSchema = z.object({
  orderType: z.enum(["dine_in", "takeaway"]),
  tableId: z.string().nullable().default(null),
  customerName: z.string().trim().max(40).default(""),
  note: z.string().trim().max(200).default(""),
  items: z.array(z.object({ id: z.string(), qty: z.number().int().min(1).max(999), note: z.string().trim().max(120).optional() })).min(1, "Keranjang masih kosong.").max(60),
  payment: z.object({ method: z.enum(["cash", "qris", "transfer", "card"]), amountReceived: money.nullable().default(null) }).nullable().default(null),
});

storeRoutes.post("/orders", async (c) => {
  const t = storeOf(c);
  if (tenantLocked(t)) fail(403, "Langganan toko sedang tidak aktif. Hubungi pemilik toko untuk memperpanjang.");
  const b = posSchema.parse(await c.req.json());
  let tableLabel: string | null = null;
  if (b.tableId) {
    const tb = await first<{ label: string }>(c.var.db, "SELECT label FROM dining_tables WHERE id = ? AND tenant_id = ?", b.tableId, t.id);
    if (!tb) fail(400, "Meja tidak ditemukan.");
    tableLabel = tb.label;
  }
  const order = await createOrder(c.var.db, {
    tenant: t,
    source: "pos",
    orderType: b.orderType,
    tableId: b.tableId,
    tableLabel,
    customerName: b.customerName,
    note: b.note,
    lines: b.items,
    userId: c.var.user!.id,
    payment: b.payment,
  });
  return c.json(order, 201);
});

const NEXT: Record<string, string[]> = {
  new: ["preparing", "cancelled"],
  preparing: ["ready", "done", "cancelled"],
  ready: ["done", "preparing", "cancelled"],
  done: ["ready"],
  cancelled: [],
};

storeRoutes.patch("/orders/:id/status", async (c) => {
  const t = storeOf(c);
  const b = z.object({ status: z.enum(["new", "preparing", "ready", "done", "cancelled"]), reason: z.string().trim().max(120).optional() }).parse(await c.req.json());
  const o = await first<{ id: string; status: string; payment_status: string }>(c.var.db, "SELECT id, status, payment_status FROM orders WHERE id = ? AND tenant_id = ?", c.req.param("id"), t.id);
  if (!o) fail(404, "Pesanan tidak ditemukan.");
  if (!NEXT[o.status]?.includes(b.status)) fail(409, "Status pesanan sudah berubah. Muat ulang daftar pesanan.");
  if (b.status === "cancelled" && o.payment_status === "paid") {
    if (!MANAGEMENT.includes(c.var.user!.role)) fail(403, "Pesanan yang sudah dibayar hanya bisa dibatalkan manajemen.");
  }
  const now = Date.now();
  const s: Stmt[] = [
    stmt(c.var.db, `UPDATE orders SET status = ?, cancel_reason = ?, updated_at = ? WHERE id = ? AND status = ?${b.status === "cancelled" && !MANAGEMENT.includes(c.var.user!.role) ? " AND payment_status = 'unpaid'" : ""}`, b.status, b.status === "cancelled" ? b.reason ?? "" : null, now, o.id, o.status),
  ];
  if (b.status === "cancelled") s.push(...(await restockCancelledOrder(c.var.db, t.id, o.id, c.var.user!.id)));
  await c.var.db.batch(s);
  return c.json({ ok: true });
});

storeRoutes.patch("/orders/:id/pay", async (c) => {
  const t = storeOf(c);
  const b = z.object({ method: z.enum(["cash", "qris", "transfer", "card"]), amountReceived: money.nullable().default(null) }).parse(await c.req.json());
  const o = await first<{ id: string; total: number; payment_status: string; status: string }>(c.var.db, "SELECT id, total, payment_status, status FROM orders WHERE id = ? AND tenant_id = ?", c.req.param("id"), t.id);
  if (!o) fail(404, "Pesanan tidak ditemukan.");
  if (o.status === "cancelled") fail(409, "Pesanan ini sudah dibatalkan.");
  if (o.payment_status === "paid") fail(409, "Pesanan ini sudah lunas.");
  if (b.method === "cash" && b.amountReceived != null && b.amountReceived < o.total) fail(400, "Uang yang diterima kurang dari total.");
  const now = Date.now();
  const n = await run(c.var.db, "UPDATE orders SET payment_status = 'paid', payment_method = ?, amount_received = ?, paid_by = ?, paid_at = ?, updated_at = ? WHERE id = ? AND payment_status = 'unpaid' AND status != 'cancelled'", b.method, b.amountReceived, c.var.user!.id, now, now, o.id);
  if (!n) fail(409, "Pesanan ini baru saja diubah di perangkat lain. Muat ulang.");
  return c.json({ ok: true });
});

// ---------- Stok ----------

storeRoutes.get("/stock", async (c) => {
  const t = storeOf(c);
  const items = await all(
    c.var.db,
    `SELECT m.id, m.name, m.unit, m.stock_qty, m.low_stock_at, m.track_stock, m.available, c.name AS category_name
     FROM menu_items m LEFT JOIN categories c ON c.id = m.category_id
     WHERE m.tenant_id = ? AND m.archived = 0 ORDER BY m.track_stock DESC, (m.stock_qty <= m.low_stock_at) DESC, m.name`,
    t.id,
  );
  const movements = await all(
    c.var.db,
    `SELECT s.id, s.change, s.reason, s.note, s.created_at, m.name AS item_name, m.unit, u.name AS user_name, o.number AS order_number
     FROM stock_movements s JOIN menu_items m ON m.id = s.menu_item_id
     LEFT JOIN users u ON u.id = s.user_id LEFT JOIN orders o ON o.id = s.order_id
     WHERE s.tenant_id = ? ORDER BY s.created_at DESC LIMIT 60`,
    t.id,
  );
  return c.json({ enabled: !!t.inventory_enabled, items, movements });
});

const moveSchema = z.object({
  itemId: z.string(),
  mode: z.enum(["restock", "waste", "set"]),
  qty: z.number().int().min(0).max(1_000_000),
  note: z.string().trim().max(120).default(""),
});

storeRoutes.post("/stock/movements", mgmt, async (c) => {
  const t = storeOf(c);
  if (!t.inventory_enabled) fail(400, "Fitur stok belum dinyalakan di Pengaturan.");
  const b = moveSchema.parse(await c.req.json());
  const it = await first<{ stock_qty: number }>(c.var.db, "SELECT stock_qty FROM menu_items WHERE id = ? AND tenant_id = ? AND archived = 0", b.itemId, t.id);
  if (!it) fail(404, "Barang tidak ditemukan.");
  const change = b.mode === "restock" ? b.qty : b.mode === "waste" ? -b.qty : b.qty - it.stock_qty;
  if (change === 0) return c.json({ ok: true });
  if (it.stock_qty + change < 0) fail(400, `Stok saat ini hanya ${it.stock_qty}.`);
  const reason = b.mode === "set" ? "adjust" : b.mode;
  await c.var.db.batch([
    stmt(c.var.db, "UPDATE menu_items SET stock_qty = stock_qty + ?, track_stock = 1 WHERE id = ? AND tenant_id = ?", change, b.itemId, t.id),
    stmt(c.var.db, `INSERT INTO stock_movements (id, tenant_id, menu_item_id, change, reason, note, user_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, newId(), t.id, b.itemId, change, reason, b.note, c.var.user!.id, Date.now()),
  ]);
  return c.json({ ok: true });
});

// ---------- Karyawan & akun ----------

storeRoutes.get("/staff", mgmt, async (c) => {
  const t = storeOf(c);
  return c.json({
    staff: await all(c.var.db, "SELECT id, name, login, role, active, last_login_at, created_at FROM users WHERE tenant_id = ? ORDER BY role = 'owner' DESC, role = 'manager' DESC, name", t.id),
    limit: t.max_staff,
  });
});

const staffSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 huruf.").max(60),
  login: z.string().trim().toLowerCase().min(3, "Username minimal 3 huruf.").max(120).regex(/^[a-z0-9._@+-]+$/, "Username hanya boleh huruf, angka, titik, atau @."),
  role: z.enum(["manager", "staff"]),
  password: z.string().min(6, "Kata sandi minimal 6 karakter.").max(200).optional(),
  active: bool.default(1),
});

storeRoutes.post("/staff", mgmt, async (c) => {
  const t = storeOf(c);
  const b = staffSchema.parse(await c.req.json());
  if (!b.password) fail(400, "Kata sandi wajib diisi untuk akun baru.");
  if (b.role === "manager" && c.var.user!.role !== "owner") fail(403, "Hanya pemilik yang bisa menambah manajer.");
  const n = await first<{ n: number }>(c.var.db, "SELECT COUNT(*) AS n FROM users WHERE tenant_id = ? AND role != 'owner' AND active = 1", t.id);
  if ((n?.n ?? 0) >= t.max_staff) fail(403, `Paket ${t.plan_name} maksimal ${t.max_staff} akun karyawan aktif.`);
  if (await first(c.var.db, "SELECT 1 FROM users WHERE login = ?", b.login)) fail(409, "Username ini sudah dipakai. Coba tambahkan nama toko, mis. budi.warungku");
  const id = newId();
  await run(c.var.db, "INSERT INTO users (id, tenant_id, name, login, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", id, t.id, b.name, b.login, await hashPassword(b.password), b.role, b.active, Date.now());
  return c.json({ id }, 201);
});

storeRoutes.put("/staff/:id", mgmt, async (c) => {
  const t = storeOf(c);
  const b = staffSchema.parse(await c.req.json());
  const target = await first<{ role: string; login: string; active: number }>(c.var.db, "SELECT role, login, active FROM users WHERE id = ? AND tenant_id = ?", c.req.param("id"), t.id);
  if (!target) fail(404, "Akun tidak ditemukan.");
  if (target.role === "owner") fail(403, "Akun pemilik diubah lewat menu Akun saya.");
  const me = c.var.user!;
  if (me.role !== "owner" && (target.role === "manager" || b.role === "manager")) fail(403, "Hanya pemilik yang bisa mengubah akun manajer.");
  if (b.login !== target.login && (await first(c.var.db, "SELECT 1 FROM users WHERE login = ?", b.login))) fail(409, "Username ini sudah dipakai.");
  if (b.active && !target.active) {
    const n = await first<{ n: number }>(c.var.db, "SELECT COUNT(*) AS n FROM users WHERE tenant_id = ? AND role != 'owner' AND active = 1", t.id);
    if ((n?.n ?? 0) >= t.max_staff) fail(403, `Paket ${t.plan_name} maksimal ${t.max_staff} akun karyawan aktif.`);
  }
  const s: Stmt[] = [
    stmt(c.var.db, "UPDATE users SET name = ?, login = ?, role = ?, active = ? WHERE id = ? AND tenant_id = ?", b.name, b.login, b.role, b.active, c.req.param("id"), t.id),
  ];
  if (b.password) s.push(stmt(c.var.db, "UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(b.password), c.req.param("id")));
  // Akun nonaktif atau sandi diganti: keluarkan dari semua perangkat.
  if (!b.active || b.password) s.push(stmt(c.var.db, "DELETE FROM sessions WHERE user_id = ?", c.req.param("id")));
  await c.var.db.batch(s);
  return c.json({ ok: true });
});

// ---------- Langganan (dilihat pemilik) ----------

storeRoutes.get("/subscription", mgmt, async (c) => {
  const t = storeOf(c);
  const payments = await all(c.var.db, "SELECT p.amount, p.months, p.method, p.created_at, p.period_end_after, pl.name AS plan_name FROM subscription_payments p JOIN plans pl ON pl.id = p.plan_id WHERE p.tenant_id = ? ORDER BY p.created_at DESC LIMIT 24", t.id);
  const plans = await all(c.var.db, "SELECT id, name, price_monthly, max_tables, max_staff, allow_video, allow_inventory, allow_analytics FROM plans WHERE active = 1 ORDER BY sort, price_monthly");
  return c.json({ payments, plans });
});

storeRoutes.route("/analytics", analyticsRoutes);
