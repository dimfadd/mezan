import type { DB } from "../db/types";
import { first, run, stmt } from "../db/types";
import { newId } from "./security";
import type { Tenant } from "./auth";

/** Nomor HP Indonesia ke format 62xxxxxxxxx. Null kalau jelas bukan nomor HP. */
export function normalizePhone(raw: string | null | undefined) {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  else if (d.startsWith("8")) d = `62${d}`;
  if (!/^62\d{8,13}$/.test(d)) return null;
  return d;
}

export interface Card {
  phone: string;
  name: string;
  stamps: number;
  target: number;
  reward: string;
  ready: boolean;
  rewards: number;
}

type MemberRow = { id: string; phone: string; name: string; stamps: number; rewards: number };

function card(t: Tenant, m: MemberRow): Card {
  return { phone: m.phone, name: m.name, stamps: m.stamps, target: t.loyalty_target, reward: t.loyalty_reward, ready: m.stamps >= t.loyalty_target, rewards: m.rewards };
}

export async function getMember(db: DB, t: Tenant, phone: string) {
  return first<MemberRow>(db, "SELECT id, phone, name, stamps, rewards FROM loyalty_members WHERE tenant_id = ? AND phone = ?", t.id, phone);
}

export async function memberCard(db: DB, t: Tenant, phone: string) {
  const m = await getMember(db, t, phone);
  return m ? card(t, m) : null;
}

/**
 * Beri satu stempel untuk pesanan yang sudah dibayar. Satu pesanan hanya bisa memberi satu stempel
 * (dijaga indeks unik), dan pesanan di bawah minimal belanja tetap tercatat sebagai kunjungan tanpa stempel.
 */
export async function awardStamp(db: DB, t: Tenant, orderId: string, rawPhone: string, name: string, userId: string | null) {
  if (!t.loyalty_enabled) return null;
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;
  const order = await first<{ total: number; payment_status: string; status: string; member_id: string | null }>(
    db,
    "SELECT total, payment_status, status, member_id FROM orders WHERE id = ? AND tenant_id = ?",
    orderId,
    t.id,
  );
  if (!order || order.payment_status !== "paid" || order.status === "cancelled") return null;
  const now = Date.now();
  await run(db, "INSERT OR IGNORE INTO loyalty_members (id, tenant_id, phone, name, created_at) VALUES (?, ?, ?, ?, ?)", newId(), t.id, phone, name.trim().slice(0, 40), now);
  const m = (await getMember(db, t, phone))!;
  // Pesanan ini sudah dipakai oleh nomor lain: jangan dipindah.
  if (order.member_id && order.member_id !== m.id) return { card: card(t, m), stamped: false };
  let stamped = false;
  if (order.total >= t.loyalty_min_spend) {
    const n = await run(
      db,
      `INSERT INTO loyalty_events (id, tenant_id, member_id, order_id, kind, delta, user_id, created_at)
       SELECT ?, ?, ?, ?, 'stamp', 1, ?, ? WHERE NOT EXISTS (SELECT 1 FROM loyalty_events WHERE order_id = ? AND kind = 'stamp')`,
      newId(), t.id, m.id, orderId, userId, now, orderId,
    ).catch(() => 0); // indeks unik menolak permintaan dobel yang datang bersamaan
    stamped = n === 1;
  }
  await db.batch([
    stmt(db, `UPDATE loyalty_members SET stamps = stamps + ?, total_stamps = total_stamps + ?, last_visit_at = ?,
              name = CASE WHEN name = '' THEN ? ELSE name END WHERE id = ?`, stamped ? 1 : 0, stamped ? 1 : 0, now, name.trim().slice(0, 40), m.id),
    stmt(db, "UPDATE orders SET member_id = ? WHERE id = ? AND member_id IS NULL", m.id, orderId),
  ]);
  return { card: card(t, (await getMember(db, t, phone))!), stamped };
}

export async function redeem(db: DB, t: Tenant, phone: string, userId: string | null) {
  const m = await getMember(db, t, phone);
  if (!m || m.stamps < t.loyalty_target) return null;
  const now = Date.now();
  const n = await run(db, "UPDATE loyalty_members SET stamps = stamps - ?, rewards = rewards + 1 WHERE id = ? AND stamps >= ?", t.loyalty_target, m.id, t.loyalty_target);
  if (!n) return null;
  await run(db, "INSERT INTO loyalty_events (id, tenant_id, member_id, kind, delta, user_id, created_at) VALUES (?, ?, ?, 'redeem', ?, ?, ?)", newId(), t.id, m.id, -t.loyalty_target, userId, now);
  return card(t, (await getMember(db, t, phone))!);
}
