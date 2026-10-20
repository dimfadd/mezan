import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../app";
import { all, stmt } from "../db/types";
import { ALL_STORE, requireStore, storeOf } from "../lib/auth";
import { fail } from "../lib/http";
import { newId } from "../lib/security";
import { awardStamp, normalizePhone } from "../lib/loyalty";

// Tagihan meja untuk "makan dulu, bayar belakangan": semua pesanan yang belum dibayar,
// dikelompokkan per meja (atau per pesanan kalau tanpa meja), dan dibayar sekaligus.
export const billRoutes = new Hono<Env>();
billRoutes.use("/bills", requireStore(ALL_STORE));
billRoutes.use("/bills/*", requireStore(ALL_STORE));

const DAY = 86_400_000;
/** Dianggap "belum bayar terlalu lama" setelah sekian menit sejak siap/diantar. */
export const UNPAID_ALERT_MIN = 30;

type Row = {
  id: string;
  number: number;
  table_id: string | null;
  table_label: string | null;
  customer_name: string;
  order_type: string;
  status: string;
  total: number;
  created_at: number;
  ready_at: number | null;
  updated_at: number;
};

export async function unpaidOrders(db: Env["Variables"]["db"], tenantId: string) {
  return all<Row>(
    db,
    `SELECT id, number, table_id, table_label, customer_name, order_type, status, total, created_at, ready_at, updated_at FROM orders
     WHERE tenant_id = ? AND payment_status = 'unpaid' AND status != 'cancelled' AND created_at > ? ORDER BY created_at`,
    tenantId,
    Date.now() - 3 * DAY,
  );
}

billRoutes.get("/bills", async (c) => {
  const t = storeOf(c);
  const rows = await unpaidOrders(c.var.db, t.id);
  const now = Date.now();
  const groups = new Map<string, { key: string; table_label: string | null; names: string[]; orders: Row[]; total: number; first_at: number; served_at: number | null }>();
  for (const r of rows) {
    // Pesanan di meja yang sama digabung; bawa pulang / tanpa meja berdiri sendiri.
    const key = r.table_id ? `t:${r.table_id}` : `o:${r.id}`;
    const g = groups.get(key) ?? { key, table_label: r.table_label, names: [], orders: [], total: 0, first_at: r.created_at, served_at: null };
    g.orders.push(r);
    g.total += r.total;
    if (r.customer_name && !g.names.includes(r.customer_name)) g.names.push(r.customer_name);
    // Kapan mulai "sudah makan": pesanan pertama yang siap/diantar.
    const served = r.status === "ready" || r.status === "done" ? (r.ready_at ?? r.updated_at) : null;
    if (served && (g.served_at == null || served < g.served_at)) g.served_at = served;
    groups.set(key, g);
  }
  const list = [...groups.values()].map((g) => ({
    ...g,
    unpaid_min: g.served_at ? Math.floor((now - g.served_at) / 60_000) : null,
    overdue: g.served_at != null && now - g.served_at > UNPAID_ALERT_MIN * 60_000,
    orders: g.orders.map((o) => ({ id: o.id, number: o.number, total: o.total, status: o.status, customer_name: o.customer_name, created_at: o.created_at })),
  }));
  list.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.first_at - b.first_at);
  return c.json({ bills: list, alertMin: UNPAID_ALERT_MIN, now });
});

const paySchema = z.object({
  orderIds: z.array(z.string().max(64)).min(1).max(30),
  method: z.enum(["cash", "qris", "transfer", "card"]),
  amountReceived: z.number().int().min(0).max(1_000_000_000).nullable().default(null),
  phone: z.string().trim().max(30).optional(),
});

/** Bayar beberapa pesanan dalam satu transaksi. Semua atau tidak sama sekali. */
billRoutes.post("/bills/pay", async (c) => {
  const t = storeOf(c);
  const b = paySchema.parse(await c.req.json());
  const ids = [...new Set(b.orderIds)];
  const phone = b.phone ? normalizePhone(b.phone) : null;
  if (b.phone && !phone) fail(400, "Nomor HP untuk kartu stempel belum benar. Contoh: 0812 3456 7890.");
  const rows = await all<{ id: string; total: number; payment_status: string; status: string; customer_name: string }>(
    c.var.db,
    `SELECT id, total, payment_status, status, customer_name FROM orders WHERE tenant_id = ? AND id IN (${ids.map(() => "?").join(",")})`,
    t.id,
    ...ids,
  );
  if (rows.length !== ids.length) fail(404, "Ada pesanan yang tidak ditemukan. Muat ulang.");
  if (rows.some((r) => r.status === "cancelled")) fail(409, "Ada pesanan yang sudah dibatalkan. Muat ulang tagihan.");
  if (rows.some((r) => r.payment_status === "paid")) fail(409, "Ada pesanan yang sudah dibayar di perangkat lain. Muat ulang tagihan.");
  const total = rows.reduce((n, r) => n + r.total, 0);
  if (b.method === "cash" && b.amountReceived != null && b.amountReceived < total) fail(400, "Uang yang diterima kurang dari total tagihan.");
  const now = Date.now();
  const billId = newId();
  const q = rows.map(() => "?").join(",");
  try {
    await c.var.db.batch([
      stmt(c.var.db, `UPDATE orders SET payment_status = 'paid', payment_method = ?, paid_by = ?, paid_at = ?, updated_at = ?, bill_id = ?
                      WHERE tenant_id = ? AND payment_status = 'unpaid' AND status != 'cancelled' AND id IN (${q})`,
        b.method, c.var.user!.id, now, now, billId, t.id, ...rows.map((r) => r.id)),
      // Gagal (CHECK) kalau ada pesanan yang tidak ikut berubah, sehingga UPDATE di atas ikut dibatalkan.
      stmt(c.var.db, "INSERT INTO bill_guard (id, diff) VALUES (?, (SELECT COUNT(*) FROM orders WHERE bill_id = ?) - ?)", billId, billId, rows.length),
    ]);
  } catch (e) {
    if (String(e).includes("CHECK")) fail(409, "Tagihan ini baru saja diubah di perangkat lain. Muat ulang.");
    throw e;
  }
  // Satu kunjungan = satu stempel: diberikan ke pesanan terbesar di tagihan ini.
  const main = rows.reduce((a, r) => (r.total > a.total ? r : a), rows[0]);
  const loyalty = phone ? await awardStamp(c.var.db, t, main.id, phone, main.customer_name, c.var.user!.id) : null;
  return c.json({ ok: true, billId, total, change: b.method === "cash" && b.amountReceived != null ? b.amountReceived - total : null, loyalty });
});
