import type { DB, Stmt } from "../db/types";
import { all, first, stmt } from "../db/types";
import { businessDay, fail } from "./http";
import { newId, randomToken } from "./security";
import type { Tenant } from "./auth";
import { serverMsgs, type Lang } from "../../../shared/i18n";
import { availableAt, clockAt, priceInfo, scheduleText, type PriceRule } from "../../../shared/schedule";

export interface OrderLineInput {
  id: string;
  qty: number;
  note?: string;
  person?: string;
}

export interface CreateOrderInput {
  tenant: Tenant;
  source: "qr" | "pos";
  orderType: "dine_in" | "takeaway";
  tableId: string | null;
  tableLabel: string | null;
  customerName: string;
  note: string;
  lines: OrderLineInput[];
  userId: string | null;
  payment?: { method: string; amountReceived: number | null } | null;
  lang?: Lang;
  geo?: { check: string; distance: number | null };
  /** ID dari perangkat kasir; kiriman ulang dengan ID yang sama tidak membuat pesanan dobel. */
  clientId?: string | null;
  /** Pesanan yang dicatat saat internet putus: waktu aslinya, dan penjualan sudah terjadi sehingga tidak boleh ditolak karena stok/jadwal. */
  offline?: { at: number } | null;
}

interface ItemRow {
  id: string;
  name: string;
  name_en: string;
  price: number;
  available: number;
  track_stock: number;
  stock_qty: number;
  archived: number;
  category_id: string | null;
  category_name: string | null;
  station: string;
  avail_days: number;
  avail_from: number | null;
  avail_to: number | null;
  cost: number | null;
}

export async function loadPriceRules(db: DB, tenantId: string) {
  return all<PriceRule>(db, "SELECT id, name, percent, days, start_min, end_min, category_ids, active FROM price_rules WHERE tenant_id = ? AND active = 1", tenantId);
}

type Existing = { id: string; number: number; public_token: string; subtotal: number; service: number; tax: number; total: number };
async function findByClientId(db: DB, tenantId: string, clientId: string) {
  const o = await first<Existing>(db, "SELECT id, number, public_token, subtotal, service, tax, total FROM orders WHERE tenant_id = ? AND client_id = ?", tenantId, clientId);
  return o ? { id: o.id, number: o.number, token: o.public_token, subtotal: o.subtotal, service: o.service, tax: o.tax, total: o.total, duplicate: true } : null;
}

export function computeTotals(subtotal: number, taxRate: number, serviceRate: number) {
  // Service dihitung dari subtotal, pajak dihitung dari subtotal + service (praktik umum PB1 resto).
  const service = Math.round((subtotal * serviceRate) / 100);
  const tax = Math.round(((subtotal + service) * taxRate) / 100);
  return { subtotal, service, tax, total: subtotal + service + tax };
}

/**
 * Membuat pesanan: validasi harga dari database (bukan dari klien), cek stok,
 * lalu tulis pesanan + item + pergerakan stok dalam satu batch.
 */
export async function createOrder(db: DB, input: CreateOrderInput) {
  const t = input.tenant;
  const lang = input.lang ?? "id";
  const M = serverMsgs(lang);
  const nm = (it: ItemRow) => (lang === "en" && it.name_en ? it.name_en : it.name);
  const offline = !!input.offline;
  if (input.clientId) {
    const dup = await findByClientId(db, t.id, input.clientId);
    if (dup) return dup;
  }
  if (input.lines.length === 0) fail(400, M.cartEmpty);
  const merged = new Map<string, OrderLineInput>();
  for (const l of input.lines) {
    // item yang sama dengan catatan berbeda tetap dipisah
    const key = `${l.id}|${(l.note ?? "").trim()}|${l.person ?? ""}`;
    const prev = merged.get(key);
    if (prev) prev.qty += l.qty;
    else merged.set(key, { ...l, note: (l.note ?? "").trim(), person: (l.person ?? "").trim() });
  }
  const ids = [...new Set(input.lines.map((l) => l.id))];
  const [items, rules] = await Promise.all([
    all<ItemRow>(
      db,
      `SELECT m.id, m.name, m.name_en, m.price, m.available, m.track_stock, m.stock_qty, m.archived, m.category_id,
              m.avail_days, m.avail_from, m.avail_to, m.cost, c.name AS category_name, COALESCE(c.station, 'kitchen') AS station
       FROM menu_items m LEFT JOIN categories c ON c.id = m.category_id
       WHERE m.tenant_id = ? AND m.id IN (${ids.map(() => "?").join(",")})`,
      t.id,
      ...ids,
    ),
    loadPriceRules(db, t.id),
  ]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const useStock = !!t.inventory_enabled;
  const now = Date.now();
  // Pesanan offline memakai waktu saat dicatat, supaya harga promo, tanggal, dan shift-nya sesuai kenyataan.
  const at = offline ? input.offline!.at : now;
  const clock = clockAt(at, t.tz_offset_minutes);
  const needed = new Map<string, number>();
  const unit = new Map<string, { price: number; list: number }>();
  let subtotal = 0;
  for (const l of merged.values()) {
    const it = byId.get(l.id);
    if (!it || (it.archived && !offline)) fail(400, M.itemGone);
    if (!offline) {
      if (!it.available) fail(409, M.soldOut(nm(it)));
      if (!availableAt(it, clock)) fail(409, M.offHours(nm(it), scheduleText(it, lang)));
    }
    const p = priceInfo(it, rules, clock);
    unit.set(it.id, p);
    subtotal += p.price * l.qty;
    needed.set(it.id, (needed.get(it.id) ?? 0) + l.qty);
  }
  if (useStock && !offline) {
    for (const [id, qty] of needed) {
      const it = byId.get(id)!;
      if (it.track_stock && it.stock_qty < qty) {
        fail(409, it.stock_qty > 0 ? M.onlyLeft(nm(it), it.stock_qty) : M.soldOut(nm(it)));
      }
    }
  }
  const totals = computeTotals(subtotal, t.tax_rate, t.service_rate);
  const day = businessDay(at, t.tz_offset_minutes);
  const orderId = newId();
  const token = randomToken(16);
  const pay = input.payment;
  if (!offline && pay && pay.method === "cash" && pay.amountReceived != null && pay.amountReceived < totals.total) {
    fail(400, "Uang yang diterima kurang dari total.");
  }

  // Nomor antrean harian. Kalau dua pesanan masuk bersamaan dan nomornya bentrok,
  // indeks unik menolak salah satunya dan kita coba lagi.
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await first<{ n: number | null }>(
      db,
      "SELECT MAX(number) AS n FROM orders WHERE tenant_id = ? AND business_day = ?",
      t.id,
      day,
    );
    const number = (row?.n ?? 0) + 1;
    const statements: Stmt[] = [
      stmt(
        db,
        `INSERT INTO orders (id, tenant_id, number, business_day, table_id, table_label, source, order_type, customer_name,
           status, payment_status, payment_method, amount_received, subtotal, tax, service, total, note, public_token,
           created_by, paid_by, created_at, updated_at, paid_at, geo_check, geo_distance_m, client_id, offline, accepted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        orderId, t.id, number, day, input.tableId, input.tableLabel, input.source, input.orderType, input.customerName,
        input.source === "pos" ? "preparing" : "new",
        pay ? "paid" : "unpaid", pay?.method ?? null, pay?.amountReceived ?? null,
        totals.subtotal, totals.tax, totals.service, totals.total, input.note, token,
        input.userId, pay ? input.userId : null, at, now, pay ? at : null, input.geo?.check ?? "", input.geo?.distance ?? null,
        input.clientId ?? null, offline ? 1 : 0, input.source === "pos" ? at : null,
      ),
    ];
    for (const l of merged.values()) {
      const it = byId.get(l.id)!;
      const p = unit.get(it.id)!;
      statements.push(
        stmt(db, `INSERT INTO order_items (id, order_id, menu_item_id, category_name, name, price, qty, note, person, station, list_price, unit_cost)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          newId(), orderId, it.id, it.category_name ?? "", it.name, p.price, l.qty, l.note ?? "", l.person ?? "",
          it.station === "bar" ? "bar" : "kitchen", p.list !== p.price ? p.list : null, it.cost),
      );
    }
    if (useStock) {
      for (const [id, qty] of needed) {
        const it = byId.get(id)!;
        if (!it.track_stock) continue;
        // Offline: barang sudah keluar; stok dicatat turun sampai nol, tidak minus.
        const take = offline ? Math.min(qty, Math.max(0, it.stock_qty)) : qty;
        if (take <= 0) continue;
        statements.push(stmt(db, `UPDATE menu_items SET stock_qty = ${offline ? "MAX(stock_qty - ?, 0)" : "stock_qty - ?"} WHERE id = ? AND tenant_id = ?`, take, id, t.id));
        statements.push(
          stmt(db, `INSERT INTO stock_movements (id, tenant_id, menu_item_id, change, reason, order_id, user_id, created_at)
                    VALUES (?, ?, ?, ?, 'sale', ?, ?, ?)`, newId(), t.id, id, -take, orderId, input.userId, now),
        );
      }
    }
    try {
      await db.batch(statements);
      return { id: orderId, number, token, ...totals, duplicate: false };
    } catch (e) {
      const msg = String(e);
      if (msg.includes("UNIQUE") && input.clientId) {
        // Kiriman ganda dari perangkat yang sama datang bersamaan: kembalikan yang sudah tersimpan.
        const dup = await findByClientId(db, t.id, input.clientId);
        if (dup) return dup;
      }
      if (msg.includes("UNIQUE") && attempt < 4) continue;
      // Dua pesanan berebut stok terakhir: CHECK (stock_qty >= 0) menggagalkan seluruh batch.
      if (msg.includes("CHECK")) fail(409, M.raceSoldOut);
      throw e;
    }
  }
  fail(409, M.busy);
}

/** Mengembalikan stok saat pesanan dibatalkan. */
export async function restockCancelledOrder(db: DB, tenantId: string, orderId: string, userId: string | null) {
  const moves = await all<{ menu_item_id: string; change: number }>(
    db,
    "SELECT menu_item_id, SUM(change) AS change FROM stock_movements WHERE order_id = ? AND tenant_id = ? AND reason = 'sale' GROUP BY menu_item_id",
    orderId,
    tenantId,
  );
  const now = Date.now();
  const s: Stmt[] = [];
  for (const m of moves) {
    if (m.change >= 0) continue;
    // Dijaga NOT EXISTS supaya permintaan batal yang dobel tidak mengembalikan stok dua kali.
    const notYet = "NOT EXISTS (SELECT 1 FROM stock_movements WHERE order_id = ? AND menu_item_id = ? AND reason = 'cancel')";
    s.push(stmt(db, `UPDATE menu_items SET stock_qty = stock_qty + ? WHERE id = ? AND tenant_id = ? AND ${notYet}`, -m.change, m.menu_item_id, tenantId, orderId, m.menu_item_id));
    s.push(
      stmt(db, `INSERT INTO stock_movements (id, tenant_id, menu_item_id, change, reason, order_id, user_id, created_at)
                SELECT ?, ?, ?, ?, 'cancel', ?, ?, ? WHERE ${notYet}`, newId(), tenantId, m.menu_item_id, -m.change, orderId, userId, now, orderId, m.menu_item_id),
    );
  }
  return s;
}

export async function loadOrderItems(db: DB, orderIds: string[]) {
  if (orderIds.length === 0) return new Map<string, unknown[]>();
  const rows = await all<{ order_id: string } & Record<string, unknown>>(
    db,
    `SELECT id, order_id, menu_item_id, name, price, qty, note, person, station, ready_at, list_price FROM order_items
     WHERE order_id IN (${orderIds.map(() => "?").join(",")})`,
    ...orderIds,
  );
  const map = new Map<string, unknown[]>();
  for (const r of rows) {
    const list = map.get(r.order_id) ?? [];
    list.push(r);
    map.set(r.order_id, list);
  }
  return map;
}
