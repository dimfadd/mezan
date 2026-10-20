import { z } from "zod";
import type { DB, Stmt } from "../db/types";
import { all, stmt } from "../db/types";
import { fail } from "./http";
import { newId } from "./security";
import { normalizeBarcode } from "../../../shared/variants";

const MAX_VARIANTS = 100;
const code = z.string().trim().max(64).transform(normalizeBarcode).default("");

export const variantInput = z.object({
  id: z.string().max(64).optional(),
  opt1: z.string().trim().min(1, "Isi nama pilihan varian.").max(30),
  opt2: z.string().trim().max(30).default(""),
  price: z.number().int().min(0).max(1_000_000_000).nullable().default(null),
  cost: z.number().int().min(0).max(1_000_000_000).nullable().default(null),
  sku: z.string().trim().max(40).default(""),
  barcode: code,
  /** Stok yang diinginkan; selisihnya dicatat sebagai penyesuaian. Kosong = tidak diubah. */
  stock: z.number().int().min(0).max(1_000_000).nullable().default(null),
  available: z.union([z.boolean(), z.literal(0), z.literal(1)]).transform((v) => (v ? 1 : 0)).default(1),
});
export type VariantInput = z.infer<typeof variantInput>;

export const variantFields = {
  opt1_name: z.string().trim().max(20).default(""),
  opt2_name: z.string().trim().max(20).default(""),
  barcode: code,
  sku: z.string().trim().max(40).default(""),
  variants: z.array(variantInput).max(MAX_VARIANTS, `Maksimal ${MAX_VARIANTS} varian per produk.`).default([]),
};

export interface VariantRow {
  id: string;
  item_id: string;
  opt1: string;
  opt2: string;
  price: number | null;
  cost: number | null;
  sku: string;
  barcode: string;
  stock_qty: number;
  available: number;
  sort: number;
}

export async function loadItemVariants(db: DB, tenantId: string) {
  const rows = await all<VariantRow>(
    db,
    `SELECT id, item_id, opt1, opt2, price, cost, sku, barcode, stock_qty, available, sort FROM item_variants
     WHERE tenant_id = ? AND archived = 0 ORDER BY sort, opt1, opt2`,
    tenantId,
  );
  const map = new Map<string, VariantRow[]>();
  for (const r of rows) {
    const list = map.get(r.item_id) ?? [];
    list.push(r);
    map.set(r.item_id, list);
  }
  return map;
}

/** Barcode harus unik di satu toko, baik di produk maupun di varian, supaya hasil scan tidak ambigu. */
export async function checkBarcodes(db: DB, tenantId: string, itemId: string | null, codes: string[]) {
  const list = codes.filter(Boolean);
  const seen = new Set<string>();
  for (const c of list) {
    if (seen.has(c)) fail(400, `Barcode ${c} dipakai dua kali di produk ini.`);
    seen.add(c);
  }
  if (!list.length) return;
  const q = list.map(() => "?").join(",");
  const clash = await all<{ name: string; barcode: string }>(
    db,
    `SELECT name, barcode FROM menu_items WHERE tenant_id = ? AND archived = 0 AND barcode IN (${q}) AND id != ?
     UNION ALL
     SELECT m.name, v.barcode FROM item_variants v JOIN menu_items m ON m.id = v.item_id
     WHERE v.tenant_id = ? AND v.archived = 0 AND m.archived = 0 AND v.barcode IN (${q}) AND v.item_id != ?`,
    tenantId, ...list, itemId ?? "", tenantId, ...list, itemId ?? "",
  );
  if (clash.length) fail(409, `Barcode ${clash[0].barcode} sudah dipakai di ${clash[0].name}.`);
}

/**
 * Menyimpan daftar varian satu produk: yang ada diperbarui, yang baru ditambahkan, yang hilang diarsipkan
 * (riwayat penjualan tetap utuh). Stok produk induk disamakan dengan jumlah stok varian aktif.
 */
export async function saveVariants(
  db: DB,
  o: { tenantId: string; itemId: string; userId: string; variants: VariantInput[]; useStock: boolean; hasOptions: boolean },
): Promise<Stmt[]> {
  const existing = (await all<{ id: string; stock_qty: number; archived: number }>(
    db,
    "SELECT id, stock_qty, archived FROM item_variants WHERE item_id = ? AND tenant_id = ?",
    o.itemId,
    o.tenantId,
  ));
  const byId = new Map(existing.map((e) => [e.id, e]));
  const combos = new Set<string>();
  for (const v of o.variants) {
    const k = `${v.opt1.toLowerCase()}|${v.opt2.toLowerCase()}`;
    if (combos.has(k)) fail(400, `Varian ${[v.opt1, v.opt2].filter(Boolean).join(" / ")} ada dua kali.`);
    combos.add(k);
  }
  if (o.variants.length && !o.hasOptions) fail(400, "Isi nama pilihan varian, mis. Ukuran atau Warna.");
  const now = Date.now();
  const s: Stmt[] = [];
  const keep = new Set<string>();
  o.variants.forEach((v, i) => {
    const prev = v.id ? byId.get(v.id) : undefined;
    const id = prev ? prev.id : newId();
    keep.add(id);
    const current = prev && !prev.archived ? prev.stock_qty : 0;
    const want = o.useStock && v.stock != null ? v.stock : current;
    if (prev) {
      s.push(stmt(db, `UPDATE item_variants SET opt1=?, opt2=?, price=?, cost=?, sku=?, barcode=?, available=?, sort=?, archived=0, stock_qty=?
                       WHERE id=? AND tenant_id=?`, v.opt1, v.opt2, v.price, v.cost, v.sku, v.barcode, v.available, i, want, id, o.tenantId));
    } else {
      s.push(stmt(db, `INSERT INTO item_variants (id, tenant_id, item_id, opt1, opt2, price, cost, sku, barcode, stock_qty, available, sort, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, o.tenantId, o.itemId, v.opt1, v.opt2, v.price, v.cost, v.sku, v.barcode, want, v.available, i, now));
    }
    if (want !== current) {
      s.push(stmt(db, `INSERT INTO stock_movements (id, tenant_id, menu_item_id, variant_id, change, reason, note, user_id, created_at)
                       VALUES (?, ?, ?, ?, ?, 'adjust', ?, ?, ?)`, newId(), o.tenantId, o.itemId, id, want - current, prev ? "Diatur di editor produk" : "Stok awal varian", o.userId, now));
    }
  });
  for (const e of existing) {
    if (!keep.has(e.id) && !e.archived) s.push(stmt(db, "UPDATE item_variants SET archived = 1 WHERE id = ? AND tenant_id = ?", e.id, o.tenantId));
  }
  if (o.variants.length) {
    s.push(stmt(db, `UPDATE menu_items SET stock_qty = (SELECT COALESCE(SUM(stock_qty), 0) FROM item_variants WHERE item_id = ? AND archived = 0), barcode = ''
                     WHERE id = ? AND tenant_id = ?`, o.itemId, o.itemId, o.tenantId));
  }
  return s;
}
