import type { DB, Stmt } from "../db/types";
import { all, first, stmt } from "../db/types";
import { businessDay, fail } from "./http";
import { newId, randomToken } from "./security";
import type { Tenant } from "./auth";
import { serverMsgs, type Lang } from "../../../shared/i18n";

export interface OrderLineInput {
  id: string;
  qty: number;
  note?: string;
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
  category_name: string | null;
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
  if (input.lines.length === 0) fail(400, M.cartEmpty);
  const merged = new Map<string, OrderLineInput>();
  for (const l of input.lines) {
    // item yang sama dengan catatan berbeda tetap dipisah
    const key = `${l.id}|${(l.note ?? "").trim()}`;
    const prev = merged.get(key);
    if (prev) prev.qty += l.qty;
    else merged.set(key, { ...l, note: (l.note ?? "").trim() });
  }
  const ids = [...new Set(input.lines.map((l) => l.id))];
  const items = await all<ItemRow>(
    db,
    `SELECT m.id, m.name, m.name_en, m.price, m.available, m.track_stock, m.stock_qty, m.archived, c.name AS category_name
     FROM menu_items m LEFT JOIN categories c ON c.id = m.category_id
     WHERE m.tenant_id = ? AND m.id IN (${ids.map(() => "?").join(",")})`,
    t.id,
    ...ids,
  );
  const byId = new Map(items.map((i) => [i.id, i]));
  const useStock = !!t.inventory_enabled;
  const needed = new Map<string, number>();
  let subtotal = 0;
  for (const l of merged.values()) {
    const it = byId.get(l.id);
    if (!it || it.archived) fail(400, M.itemGone);
    if (!it.available) fail(409, M.soldOut(nm(it)));
    subtotal += it.price * l.qty;
    needed.set(it.id, (needed.get(it.id) ?? 0) + l.qty);
  }
  if (useStock) {
    for (const [id, qty] of needed) {
      const it = byId.get(id)!;
      if (it.track_stock && it.stock_qty < qty) {
        fail(409, it.stock_qty > 0 ? M.onlyLeft(nm(it), it.stock_qty) : M.soldOut(nm(it)));
      }
    }
  }
  const totals = computeTotals(subtotal, t.tax_rate, t.service_rate);
  const now = Date.now();
  const day = businessDay(now, t.tz_offset_minutes);
  const orderId = newId();
  const token = randomToken(16);
  const pay = input.payment;
  if (pay && pay.method === "cash" && pay.amountReceived != null && pay.amountReceived < totals.total) {
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
           created_by, paid_by, created_at, updated_at, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        orderId, t.id, number, day, input.tableId, input.tableLabel, input.source, input.orderType, input.customerName,
        input.source === "pos" ? "preparing" : "new",
        pay ? "paid" : "unpaid", pay?.method ?? null, pay?.amountReceived ?? null,
        totals.subtotal, totals.tax, totals.service, totals.total, input.note, token,
        input.userId, pay ? input.userId : null, now, now, pay ? now : null,
      ),
    ];
    for (const l of merged.values()) {
      const it = byId.get(l.id)!;
      statements.push(
        stmt(db, `INSERT INTO order_items (id, order_id, menu_item_id, category_name, name, price, qty, note)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, newId(), orderId, it.id, it.category_name ?? "", it.name, it.price, l.qty, l.note ?? ""),
      );
    }
    if (useStock) {
      for (const [id, qty] of needed) {
        const it = byId.get(id)!;
        if (!it.track_stock) continue;
        statements.push(stmt(db, "UPDATE menu_items SET stock_qty = stock_qty - ? WHERE id = ? AND tenant_id = ?", qty, id, t.id));
        statements.push(
          stmt(db, `INSERT INTO stock_movements (id, tenant_id, menu_item_id, change, reason, order_id, user_id, created_at)
                    VALUES (?, ?, ?, ?, 'sale', ?, ?, ?)`, newId(), t.id, id, -qty, orderId, input.userId, now),
        );
      }
    }
    try {
      await db.batch(statements);
      return { id: orderId, number, token, ...totals };
    } catch (e) {
      if (String(e).includes("UNIQUE") && attempt < 4) continue;
      // Dua pesanan berebut stok terakhir: CHECK (stock_qty >= 0) menggagalkan seluruh batch.
      if (String(e).includes("CHECK")) fail(409, M.raceSoldOut);
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
    `SELECT id, order_id, menu_item_id, name, price, qty, note FROM order_items
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
