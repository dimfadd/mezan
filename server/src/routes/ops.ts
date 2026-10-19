import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../app";
import { all, first, run, stmt } from "../db/types";
import { ALL_STORE, MANAGEMENT, requireStore, storeOf } from "../lib/auth";
import { fail } from "../lib/http";
import { newId } from "../lib/security";

// Shift kasir & rekap laci, dan layar dapur per bagian.
export const opsRoutes = new Hono<Env>();
opsRoutes.use("/shifts/*", requireStore(ALL_STORE));
opsRoutes.use("/kitchen/*", requireStore(ALL_STORE));

const amount = z.number().int().min(0).max(1_000_000_000);

type Shift = {
  id: string;
  status: "open" | "closed";
  opened_at: number;
  opening_cash: number;
  closed_at: number | null;
  expected_cash: number | null;
  counted_cash: number | null;
  note: string;
  opened_by_name: string | null;
  closed_by_name: string | null;
};

const SHIFT_SELECT = `SELECT s.id, s.status, s.opened_at, s.opening_cash, s.closed_at, s.expected_cash, s.counted_cash, s.note,
  uo.name AS opened_by_name, uc.name AS closed_by_name
  FROM cash_shifts s LEFT JOIN users uo ON uo.id = s.opened_by LEFT JOIN users uc ON uc.id = s.closed_by`;

/**
 * Isi laci yang seharusnya = modal awal + penjualan tunai selama shift + kas masuk - kas keluar.
 * Penjualan dihitung dari waktu bayar, jadi pesanan offline yang baru tersinkron tetap masuk ke shift yang benar.
 * Pesanan yang dibatalkan setelah dibayar dianggap uangnya sudah dikembalikan.
 */
async function summary(db: Env["Variables"]["db"], tenantId: string, s: Shift) {
  const end = s.closed_at ?? Date.now() + 1;
  const [byMethod, moves] = await Promise.all([
    all<{ method: string; orders: number; total: number }>(
      db,
      `SELECT COALESCE(payment_method, 'lainnya') AS method, COUNT(*) AS orders, SUM(total) AS total FROM orders
       WHERE tenant_id = ? AND payment_status = 'paid' AND status != 'cancelled' AND paid_at >= ? AND paid_at < ?
       GROUP BY 1 ORDER BY total DESC`,
      tenantId, s.opened_at, end,
    ),
    all<{ id: string; kind: "in" | "out"; amount: number; note: string; created_at: number; user_name: string | null }>(
      db,
      "SELECT m.id, m.kind, m.amount, m.note, m.created_at, u.name AS user_name FROM cash_moves m LEFT JOIN users u ON u.id = m.user_id WHERE m.shift_id = ? ORDER BY m.created_at",
      s.id,
    ),
  ]);
  const cash = byMethod.find((m) => m.method === "cash")?.total ?? 0;
  const cashIn = moves.filter((m) => m.kind === "in").reduce((a, m) => a + m.amount, 0);
  const cashOut = moves.filter((m) => m.kind === "out").reduce((a, m) => a + m.amount, 0);
  return {
    byMethod,
    moves,
    cash_sales: cash,
    cash_in: cashIn,
    cash_out: cashOut,
    expected: s.opening_cash + cash + cashIn - cashOut,
    sales_total: byMethod.reduce((a, m) => a + m.total, 0),
    orders: byMethod.reduce((a, m) => a + m.orders, 0),
  };
}

opsRoutes.get("/shifts/current", async (c) => {
  const t = storeOf(c);
  const s = await first<Shift>(c.var.db, `${SHIFT_SELECT} WHERE s.tenant_id = ? AND s.status = 'open'`, t.id);
  const last = s ? null : await first<Shift>(c.var.db, `${SHIFT_SELECT} WHERE s.tenant_id = ? AND s.status = 'closed' ORDER BY s.closed_at DESC LIMIT 1`, t.id);
  return c.json({ shift: s, summary: s ? await summary(c.var.db, t.id, s) : null, last });
});

opsRoutes.post("/shifts/open", async (c) => {
  const t = storeOf(c);
  const b = z.object({ opening_cash: amount, note: z.string().trim().max(200).default("") }).parse(await c.req.json());
  const id = newId();
  try {
    await run(c.var.db, "INSERT INTO cash_shifts (id, tenant_id, opened_by, opened_at, opening_cash, note) VALUES (?, ?, ?, ?, ?, ?)", id, t.id, c.var.user!.id, Date.now(), b.opening_cash, b.note);
  } catch (e) {
    if (String(e).includes("UNIQUE")) fail(409, "Shift sudah dibuka di perangkat lain. Muat ulang halaman.");
    throw e;
  }
  return c.json({ id }, 201);
});

async function openShift(c: { var: Env["Variables"] }, tenantId: string, id: string) {
  const s = await first<Shift>(c.var.db, `${SHIFT_SELECT} WHERE s.id = ? AND s.tenant_id = ?`, id, tenantId);
  if (!s) fail(404, "Shift tidak ditemukan.");
  if (s.status !== "open") fail(409, "Shift ini sudah ditutup.");
  return s;
}

opsRoutes.post("/shifts/:id/moves", async (c) => {
  const t = storeOf(c);
  const b = z
    .object({ kind: z.enum(["in", "out"]), amount: amount.min(1, "Isi jumlah uangnya."), note: z.string().trim().min(1, "Tulis keterangannya, mis. beli es batu.").max(120) })
    .parse(await c.req.json());
  const s = await openShift(c, t.id, c.req.param("id"));
  await run(c.var.db, "INSERT INTO cash_moves (id, tenant_id, shift_id, kind, amount, note, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", newId(), t.id, s.id, b.kind, b.amount, b.note, c.var.user!.id, Date.now());
  return c.json({ ok: true }, 201);
});

opsRoutes.post("/shifts/:id/close", async (c) => {
  const t = storeOf(c);
  const b = z.object({ counted_cash: amount, note: z.string().trim().max(200).default("") }).parse(await c.req.json());
  const s = await openShift(c, t.id, c.req.param("id"));
  const now = Date.now();
  const sum = await summary(c.var.db, t.id, { ...s, closed_at: now });
  const n = await run(
    c.var.db,
    "UPDATE cash_shifts SET status = 'closed', closed_by = ?, closed_at = ?, expected_cash = ?, counted_cash = ?, note = CASE WHEN ? = '' THEN note ELSE ? END WHERE id = ? AND status = 'open'",
    c.var.user!.id, now, sum.expected, b.counted_cash, b.note, b.note, s.id,
  );
  if (!n) fail(409, "Shift ini baru saja ditutup di perangkat lain.");
  return c.json({ ok: true, expected: sum.expected, counted: b.counted_cash, diff: b.counted_cash - sum.expected });
});

// Riwayat shift untuk pemilik/manajer: siapa jaga, berapa selisihnya.
opsRoutes.get("/shifts", requireStore(MANAGEMENT), async (c) => {
  const t = storeOf(c);
  const shifts = await all<Shift>(c.var.db, `${SHIFT_SELECT} WHERE s.tenant_id = ? AND s.status = 'closed' ORDER BY s.closed_at DESC LIMIT 60`, t.id);
  return c.json({ shifts });
});

opsRoutes.get("/shifts/:id", requireStore(MANAGEMENT), async (c) => {
  const t = storeOf(c);
  const s = await first<Shift>(c.var.db, `${SHIFT_SELECT} WHERE s.id = ? AND s.tenant_id = ?`, c.req.param("id"), t.id);
  if (!s) fail(404, "Shift tidak ditemukan.");
  return c.json({ shift: s, summary: await summary(c.var.db, t.id, s) });
});

// ---------- Layar dapur ----------

/** Pesanan yang sedang dibuat, dengan item per bagian (dapur/bar). Yang paling lama di atas. */
opsRoutes.get("/kitchen", async (c) => {
  const t = storeOf(c);
  const station = c.req.query("station");
  const orders = await all<{ id: string; number: number; table_label: string | null; order_type: string; customer_name: string; note: string; source: string; created_at: number; accepted_at: number | null; status: string }>(
    c.var.db,
    `SELECT id, number, table_label, order_type, customer_name, note, source, created_at, accepted_at, status FROM orders
     WHERE tenant_id = ? AND status = 'preparing' ORDER BY COALESCE(accepted_at, created_at) LIMIT 60`,
    t.id,
  );
  const ids = orders.map((o) => o.id);
  const items = ids.length
    ? await all<{ id: string; order_id: string; name: string; qty: number; note: string; person: string; station: string; ready_at: number | null; prep_minutes: number | null }>(
        c.var.db,
        `SELECT i.id, i.order_id, i.name, i.qty, i.note, i.person, i.station, i.ready_at, m.prep_minutes
         FROM order_items i LEFT JOIN menu_items m ON m.id = i.menu_item_id WHERE i.order_id IN (${ids.map(() => "?").join(",")})`,
        ...ids,
      )
    : [];
  const pending = await first<{ n: number }>(c.var.db, "SELECT COUNT(*) AS n FROM orders WHERE tenant_id = ? AND status = 'new'", t.id);
  const out = orders
    .map((o) => {
      const all = items.filter((i) => i.order_id === o.id);
      const mine = station === "kitchen" || station === "bar" ? all.filter((i) => i.station === station) : all;
      return { ...o, items: mine, other_open: all.filter((i) => !mine.includes(i) && !i.ready_at).length };
    })
    // Di layar satu bagian, pesanan yang bagiannya sudah selesai semua tidak perlu tampil lagi.
    .filter((o) => o.items.length > 0 && (station !== "kitchen" && station !== "bar" ? true : o.items.some((i) => !i.ready_at)));
  return c.json({ orders: out, waiting_accept: pending?.n ?? 0, now: Date.now() });
});

/** Kalau semua item pesanan sudah selesai, pesanan otomatis jadi "Siap diantar". */
async function advanceIfDone(db: Env["Variables"]["db"], orderId: string) {
  const left = await first<{ n: number }>(db, "SELECT COUNT(*) AS n FROM order_items WHERE order_id = ? AND ready_at IS NULL", orderId);
  if ((left?.n ?? 1) > 0) return false;
  const n = await run(db, "UPDATE orders SET status = 'ready', updated_at = ?, ready_at = COALESCE(ready_at, ?) WHERE id = ? AND status = 'preparing'", Date.now(), Date.now(), orderId);
  return n > 0;
}

async function kitchenOrder(c: { var: Env["Variables"] }, tenantId: string, orderId: string) {
  const o = await first<{ id: string; status: string }>(c.var.db, "SELECT id, status FROM orders WHERE id = ? AND tenant_id = ?", orderId, tenantId);
  if (!o) fail(404, "Pesanan tidak ditemukan.");
  if (o.status !== "preparing") fail(409, "Pesanan ini sudah tidak di dapur. Muat ulang.");
  return o;
}

opsRoutes.patch("/kitchen/items/:id", async (c) => {
  const t = storeOf(c);
  const b = z.object({ ready: z.boolean() }).parse(await c.req.json());
  const it = await first<{ order_id: string }>(c.var.db, "SELECT order_id FROM order_items WHERE id = ?", c.req.param("id"));
  if (!it) fail(404, "Item tidak ditemukan.");
  await kitchenOrder(c, t.id, it.order_id);
  await run(c.var.db, "UPDATE order_items SET ready_at = ? WHERE id = ?", b.ready ? Date.now() : null, c.req.param("id"));
  const advanced = b.ready ? await advanceIfDone(c.var.db, it.order_id) : false;
  return c.json({ ok: true, advanced });
});

opsRoutes.post("/kitchen/orders/:id/done", async (c) => {
  const t = storeOf(c);
  const b = z.object({ station: z.enum(["kitchen", "bar", "all"]).default("all") }).parse(await c.req.json());
  const o = await kitchenOrder(c, t.id, c.req.param("id"));
  const now = Date.now();
  await c.var.db.batch([
    stmt(c.var.db, `UPDATE order_items SET ready_at = ? WHERE order_id = ? AND ready_at IS NULL${b.station === "all" ? "" : " AND station = ?"}`, ...(b.station === "all" ? [now, o.id] : [now, o.id, b.station])),
  ]);
  const advanced = await advanceIfDone(c.var.db, o.id);
  return c.json({ ok: true, advanced });
});
