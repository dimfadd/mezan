import type { DB } from "../db/types";
import { all } from "../db/types";

/**
 * Perkiraan kapan pesanan siap, untuk ditampilkan ke pembeli.
 *
 * Cara hitung (sengaja sederhana supaya bisa dijelaskan ke pemilik):
 * 1. Lama masak satu pesanan = waktu saji terlama dari item yang belum selesai
 *    (item dimasak berbarengan). Kalau menu tidak punya waktu saji, pakai median
 *    riwayat toko ini, atau 10 menit kalau riwayatnya belum cukup.
 * 2. Dapur bisa mengerjakan beberapa pesanan sekaligus (pengaturan "kitchen_lanes").
 *    Pesanan di depan mengisi slot itu dulu sesuai urutan antrean, lalu pesanan
 *    pembeli masuk ke slot yang paling cepat kosong.
 * 3. Hasilnya rentang, bukan janji: bawah 85%, atas 120% dari titik tengah.
 */

const DEFAULT_MIN = 10;
const MIN = 60_000;

export interface Eta {
  position: number; // antrean ke-berapa di dapur (1 = berikutnya / sedang dimasak)
  ahead: number; // pesanan di depan
  ready_at: number; // titik tengah perkiraan (epoch ms)
  low_min: number; // rentang menit dari sekarang
  high_min: number;
  late: boolean; // sudah lewat perkiraan
  accepted: boolean; // sudah diterima kasir / mulai dimasak
  now: number;
}

type ActiveRow = { id: string; number: number; status: string; created_at: number; accepted_at: number | null };
type PrepRow = { order_id: string; prep: number | null; ready_at: number | null };

// Median lama masak per toko, dihitung dari 30 hari terakhir dan disimpan sebentar di memori.
const TTL = 10 * MIN;
const learned = new Map<string, { at: number; min: number }>();

async function typicalMinutes(db: DB, tenantId: string) {
  const hit = learned.get(tenantId);
  if (hit && Date.now() - hit.at < TTL) return hit.min;
  const rows = await all<{ d: number }>(
    db,
    `SELECT ready_at - accepted_at AS d FROM orders
     WHERE tenant_id = ? AND ready_at IS NOT NULL AND accepted_at IS NOT NULL AND ready_at > accepted_at AND created_at > ?
     ORDER BY created_at DESC LIMIT 200`,
    tenantId,
    Date.now() - 30 * 86400_000,
  );
  let min = DEFAULT_MIN;
  if (rows.length >= 8) {
    const ds = rows.map((r) => r.d / MIN).sort((a, b) => a - b);
    const mid = ds[Math.floor(ds.length / 2)];
    min = Math.min(60, Math.max(3, Math.round(mid)));
  }
  learned.set(tenantId, { at: Date.now(), min });
  if (learned.size > 500) learned.delete(learned.keys().next().value!);
  return min;
}

export function forgetEta(tenantId: string) {
  learned.delete(tenantId);
}

/** Urutan dapur: yang sedang dimasak (urut waktu diterima), lalu yang menunggu kasir (urut waktu masuk). */
export function kitchenOrder(rows: ActiveRow[]) {
  // Waktu sama persis (mis. dua pesanan di milidetik yang sama): yang masuk lebih dulu menurut waktu buat, lalu nomor.
  const tie = (a: ActiveRow, b: ActiveRow) => a.created_at - b.created_at || a.number - b.number;
  const prep = rows.filter((r) => r.status === "preparing").sort((a, b) => (a.accepted_at ?? a.created_at) - (b.accepted_at ?? b.created_at) || tie(a, b));
  const fresh = rows.filter((r) => r.status === "new").sort(tie);
  return [...prep, ...fresh];
}

/** Simulasi slot dapur. Diekspor terpisah supaya bisa diuji tanpa database. */
export function simulate(
  queue: { id: string; status: string; created_at: number; accepted_at: number | null; prepMin: number }[],
  targetId: string,
  lanes: number,
  now: number,
) {
  const free = Array.from({ length: Math.max(1, lanes) }, () => now);
  for (let i = 0; i < queue.length; i++) {
    const o = queue[i];
    let need = o.prepMin * MIN;
    if (o.status === "preparing") {
      const started = o.accepted_at ?? o.created_at;
      // Yang sudah lewat waktunya dianggap tinggal sebentar lagi, bukan nol.
      need = Math.max(need - (now - started), 2 * MIN);
    } else {
      need += MIN; // jeda kasir menerima pesanan
    }
    let lane = 0;
    for (let l = 1; l < free.length; l++) if (free[l] < free[lane]) lane = l;
    const finish = free[lane] + need;
    free[lane] = finish;
    if (o.id === targetId) return { position: i + 1, ahead: i, finish };
  }
  return null;
}

export async function orderEta(
  db: DB,
  tenant: { id: string; kitchen_lanes: number; eta_enabled: number },
  orderId: string,
  status: string,
): Promise<Eta | null> {
  if (!tenant.eta_enabled || (status !== "new" && status !== "preparing")) return null;
  const now = Date.now();
  // Pesanan yang tertinggal lebih dari 12 jam tidak ikut dihitung, supaya antrean tidak menggelembung.
  const rows = await all<ActiveRow>(
    db,
    "SELECT id, number, status, created_at, accepted_at FROM orders WHERE tenant_id = ? AND status IN ('new','preparing') AND created_at > ?",
    tenant.id,
    now - 12 * 3600_000,
  );
  const queue = kitchenOrder(rows);
  const idx = queue.findIndex((r) => r.id === orderId);
  if (idx < 0) return null;
  const upto = queue.slice(0, idx + 1);
  const ids = upto.map((r) => r.id);
  const preps = await all<PrepRow>(
    db,
    `SELECT i.order_id, m.prep_minutes AS prep, i.ready_at FROM order_items i LEFT JOIN menu_items m ON m.id = i.menu_item_id
     WHERE i.order_id IN (${ids.map(() => "?").join(",")})`,
    ...ids,
  );
  const typical = await typicalMinutes(db, tenant.id);
  const byOrder = new Map<string, number>();
  for (const id of ids) {
    const its = preps.filter((p) => p.order_id === id);
    const open = its.filter((p) => !p.ready_at);
    const set = open.map((p) => p.prep ?? 0).filter((n) => n > 0);
    // Semua item selesai: tinggal diantar. Tidak ada waktu saji: pakai kebiasaan toko.
    byOrder.set(id, its.length && !open.length ? 1 : set.length ? Math.max(...set) : typical);
  }
  const sim = simulate(
    upto.map((r) => ({ ...r, prepMin: byOrder.get(r.id) ?? typical })),
    orderId,
    tenant.kitchen_lanes || 3,
    now,
  );
  if (!sim) return null;
  const me = upto[idx];
  const mine = byOrder.get(orderId) ?? typical;
  const started = me.status === "preparing" ? me.accepted_at ?? me.created_at : null;
  const late = started != null && now - started > mine * MIN * 1.2;
  const mid = (sim.finish - now) / MIN;
  const low = Math.max(1, Math.floor(mid * 0.85));
  const high = Math.max(low + 2, Math.ceil(mid * 1.2));
  return { position: sim.position, ahead: sim.ahead, ready_at: Math.round(sim.finish), low_min: low, high_min: high, late, accepted: me.status === "preparing", now };
}
