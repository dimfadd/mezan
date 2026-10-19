import { Hono } from "hono";
import type { Env } from "../app";
import { all, first } from "../db/types";
import { MANAGEMENT, requireStore, storeOf } from "../lib/auth";
import { businessDay, fail } from "../lib/http";

export const analyticsRoutes = new Hono<Env>();
analyticsRoutes.use("*", requireStore(MANAGEMENT));

function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Laporan penjualan. Definisi yang dipakai di seluruh laporan:
 * - "Omzet" = total pesanan yang sudah dibayar (termasuk pajak & service), pesanan batal tidak dihitung.
 * - Periode memakai tanggal bisnis toko (zona waktu toko), bukan UTC.
 */
analyticsRoutes.get("/", async (c) => {
  const t = storeOf(c);
  if (!t.allow_analytics) fail(403, `Laporan analitik belum termasuk di paket ${t.plan_name}.`);
  const db = c.var.db;
  const today = businessDay(Date.now(), t.tz_offset_minutes);
  let from = c.req.query("from") ?? "";
  let to = c.req.query("to") ?? "";
  const range = c.req.query("range") ?? "7";
  if (!DAY.test(from) || !DAY.test(to)) {
    const n = range === "today" ? 1 : Math.min(Math.max(Number(range) || 7, 1), 366);
    to = today;
    from = addDays(today, -(n - 1));
  }
  if (from > to) [from, to] = [to, from];
  const span = daysBetween(from, to);
  if (span > 366) fail(400, "Rentang laporan maksimal 1 tahun.");
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(span - 1));

  type Kpi = { omzet: number; orders: number; tax: number; service: number; unpaid: number; unpaid_count: number; cancelled: number; cancelled_value: number };
  const kpiSql = `
    SELECT
      COALESCE(SUM(CASE WHEN status != 'cancelled' AND payment_status = 'paid' THEN total END), 0) AS omzet,
      COUNT(CASE WHEN status != 'cancelled' AND payment_status = 'paid' THEN 1 END) AS orders,
      COALESCE(SUM(CASE WHEN status != 'cancelled' AND payment_status = 'paid' THEN tax END), 0) AS tax,
      COALESCE(SUM(CASE WHEN status != 'cancelled' AND payment_status = 'paid' THEN service END), 0) AS service,
      COALESCE(SUM(CASE WHEN status != 'cancelled' AND payment_status = 'unpaid' THEN total END), 0) AS unpaid,
      COUNT(CASE WHEN status != 'cancelled' AND payment_status = 'unpaid' THEN 1 END) AS unpaid_count,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled,
      COALESCE(SUM(CASE WHEN status = 'cancelled' THEN total END), 0) AS cancelled_value
    FROM orders WHERE tenant_id = ? AND business_day BETWEEN ? AND ?`;
  const [kpi, prev] = await Promise.all([
    first<Kpi>(db, kpiSql, t.id, from, to),
    first<Kpi>(db, kpiSql, t.id, prevFrom, prevTo),
  ]);

  const paid = "o.tenant_id = ? AND o.business_day BETWEEN ? AND ? AND o.status != 'cancelled' AND o.payment_status = 'paid'";
  const tz = t.tz_offset_minutes * 60;

  const [daily, hourly, weekday, topItems, categories, payments, sources, itemsSold, staff, idle] = await Promise.all([
    all<{ day: string; omzet: number; orders: number }>(db,
      `SELECT o.business_day AS day, SUM(o.total) AS omzet, COUNT(*) AS orders FROM orders o WHERE ${paid} GROUP BY o.business_day`, t.id, from, to),
    all<{ hour: number; orders: number; omzet: number }>(db,
      `SELECT CAST(strftime('%H', o.created_at / 1000 + ?, 'unixepoch') AS INTEGER) AS hour, COUNT(*) AS orders, SUM(o.total) AS omzet
       FROM orders o WHERE ${paid} GROUP BY 1`, tz, t.id, from, to),
    all<{ dow: number; orders: number; omzet: number }>(db,
      `SELECT CAST(strftime('%w', o.business_day) AS INTEGER) AS dow, COUNT(*) AS orders, SUM(o.total) AS omzet
       FROM orders o WHERE ${paid} GROUP BY 1`, t.id, from, to),
    all<{ name: string; qty: number; revenue: number }>(db,
      `SELECT i.name, SUM(i.qty) AS qty, SUM(i.qty * i.price) AS revenue
       FROM order_items i JOIN orders o ON o.id = i.order_id WHERE ${paid}
       GROUP BY COALESCE(i.menu_item_id, i.name) ORDER BY qty DESC, revenue DESC LIMIT 10`, t.id, from, to),
    all<{ name: string; qty: number; revenue: number }>(db,
      `SELECT CASE WHEN i.category_name = '' THEN 'Tanpa kategori' ELSE i.category_name END AS name, SUM(i.qty) AS qty, SUM(i.qty * i.price) AS revenue
       FROM order_items i JOIN orders o ON o.id = i.order_id WHERE ${paid}
       GROUP BY 1 ORDER BY revenue DESC`, t.id, from, to),
    all<{ method: string; orders: number; omzet: number }>(db,
      `SELECT COALESCE(o.payment_method, 'lainnya') AS method, COUNT(*) AS orders, SUM(o.total) AS omzet
       FROM orders o WHERE ${paid} GROUP BY 1 ORDER BY omzet DESC`, t.id, from, to),
    all<{ source: string; orders: number; omzet: number }>(db,
      `SELECT o.source, COUNT(*) AS orders, SUM(o.total) AS omzet FROM orders o WHERE ${paid} GROUP BY o.source`, t.id, from, to),
    first<{ qty: number }>(db,
      `SELECT COALESCE(SUM(i.qty), 0) AS qty FROM order_items i JOIN orders o ON o.id = i.order_id WHERE ${paid}`, t.id, from, to),
    all<{ name: string; orders: number; omzet: number }>(db,
      `SELECT u.name, COUNT(*) AS orders, SUM(o.total) AS omzet FROM orders o JOIN users u ON u.id = o.paid_by
       WHERE ${paid} GROUP BY u.id ORDER BY omzet DESC`, t.id, from, to),
    // Menu aktif yang tidak terjual sama sekali di periode ini: bahan evaluasi menu.
    all<{ name: string; price: number }>(db,
      `SELECT m.name, m.price FROM menu_items m WHERE m.tenant_id = ? AND m.archived = 0 AND m.created_at < ? AND NOT EXISTS (
         SELECT 1 FROM order_items i JOIN orders o ON o.id = i.order_id
         WHERE i.menu_item_id = m.id AND o.business_day BETWEEN ? AND ? AND o.status != 'cancelled')
       ORDER BY m.name LIMIT 12`, t.id, Date.parse(`${to}T23:59:59Z`), from, to),
  ]);

  // Lengkapi hari yang kosong supaya grafik tidak melompat.
  const dailyMap = new Map(daily.map((d) => [d.day, d]));
  const series = Array.from({ length: span }, (_, i) => {
    const day = addDays(from, i);
    const d = dailyMap.get(day);
    return { day, omzet: d?.omzet ?? 0, orders: d?.orders ?? 0 };
  });
  const hourMap = new Map(hourly.map((h) => [h.hour, h]));
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: hourMap.get(h)?.orders ?? 0, omzet: hourMap.get(h)?.omzet ?? 0 }));
  const dowMap = new Map(weekday.map((w) => [w.dow, w]));
  const weekdays = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ dow: d, orders: dowMap.get(d)?.orders ?? 0, omzet: dowMap.get(d)?.omzet ?? 0 }));

  return c.json({
    period: { from, to, days: span, prevFrom, prevTo, today },
    kpi: { ...kpi, items_sold: itemsSold?.qty ?? 0, avg: kpi && kpi.orders ? Math.round(kpi.omzet / kpi.orders) : 0 },
    prev: { ...prev, avg: prev && prev.orders ? Math.round(prev.omzet / prev.orders) : 0 },
    series,
    hours,
    weekdays,
    topItems,
    categories,
    payments,
    sources,
    staff,
    idle,
  });
});

// Ekspor CSV pesanan untuk dibuka di Excel/Google Sheets.
analyticsRoutes.get("/export.csv", async (c) => {
  const t = storeOf(c);
  const from = c.req.query("from") ?? "";
  const to = c.req.query("to") ?? "";
  if (!DAY.test(from) || !DAY.test(to)) fail(400, "Tanggal tidak valid.");
  const rows = await all<Record<string, string | number | null>>(
    c.var.db,
    `SELECT o.business_day, o.number, o.created_at, o.table_label, o.customer_name, o.source, o.status, o.payment_status,
            o.payment_method, o.subtotal, o.service, o.tax, o.total,
            (SELECT GROUP_CONCAT(i.qty || 'x ' || i.name, '; ') FROM order_items i WHERE i.order_id = o.id) AS items
     FROM orders o WHERE o.tenant_id = ? AND o.business_day BETWEEN ? AND ? ORDER BY o.created_at`,
    t.id, from, to,
  );
  const head = ["tanggal", "no", "jam", "meja", "pelanggan", "sumber", "status", "pembayaran", "metode", "subtotal", "service", "pajak", "total", "item"];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    // cegah formula injection saat dibuka di spreadsheet
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = rows.map((r) => {
    const time = new Date(Number(r.created_at) + t.tz_offset_minutes * 60_000).toISOString().slice(11, 16);
    return [r.business_day, r.number, time, r.table_label, r.customer_name, r.source, r.status, r.payment_status, r.payment_method, r.subtotal, r.service, r.tax, r.total, r.items].map(esc).join(",");
  });
  const csv = "﻿" + [head.join(","), ...lines].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pesanin-${t.slug}-${from}-sd-${to}.csv"`,
    },
  });
});
