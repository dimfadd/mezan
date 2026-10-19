import type { DB } from "../db/types";
import { all } from "../db/types";

// Pasangan yang sering dipesan bersama dihitung dari 60 hari terakhir.
// Hasilnya disimpan sebentar di memori supaya menu tidak menghitung ulang di setiap kunjungan.
const TTL = 10 * 60_000;
const cache = new Map<string, { at: number; pairs: Map<string, string[]> }>();

async function coPurchased(db: DB, tenantId: string) {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL) return hit.pairs;
  const rows = await all<{ a: string; b: string; n: number }>(
    db,
    `SELECT x.menu_item_id AS a, y.menu_item_id AS b, COUNT(*) AS n
     FROM orders o
     JOIN order_items x ON x.order_id = o.id
     JOIN order_items y ON y.order_id = o.id AND y.menu_item_id != x.menu_item_id
     WHERE o.tenant_id = ? AND o.created_at > ? AND o.status != 'cancelled' AND x.menu_item_id IS NOT NULL AND y.menu_item_id IS NOT NULL
     GROUP BY x.menu_item_id, y.menu_item_id HAVING COUNT(*) >= 3
     ORDER BY x.menu_item_id, n DESC`,
    tenantId,
    Date.now() - 60 * 86400_000,
  );
  const pairs = new Map<string, string[]>();
  for (const r of rows) {
    const list = pairs.get(r.a) ?? [];
    if (list.length < 6) list.push(r.b);
    pairs.set(r.a, list);
  }
  cache.set(tenantId, { at: Date.now(), pairs });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return pairs;
}

export function forgetPairs(tenantId: string) {
  cache.delete(tenantId);
}

/**
 * Maksimal 3 saran per menu: pilihan pemilik dulu, lalu yang sering dipesan bersama.
 * Hanya menu yang masih dijual. Saran dari kategori yang sama dilewati supaya
 * yang muncul pelengkap (minuman untuk makanan), bukan pengganti.
 */
export async function attachPairs<T extends { id: string; pair_ids?: string; category_id: string | null }>(db: DB, tenantId: string, items: T[], sellable: (id: string) => boolean) {
  const auto = await coPurchased(db, tenantId);
  const cat = new Map(items.map((i) => [i.id, i.category_id]));
  return items.map((it) => {
    const manual = (it.pair_ids ?? "").split(",").filter((id) => id && id !== it.id && cat.has(id));
    const learned = (auto.get(it.id) ?? []).filter((id) => cat.has(id) && (!it.category_id || cat.get(id) !== it.category_id));
    const pairs = [...new Set([...manual, ...learned])].filter(sellable).slice(0, 3);
    return { ...it, pairs };
  });
}
