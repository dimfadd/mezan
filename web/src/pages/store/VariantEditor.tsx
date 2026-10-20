import { useState } from "react";
import { Barcode, ScanLine, Wand2 } from "lucide-react";
import { Field, MoneyInput, Switch } from "../../components/ui";
import { CameraScanner } from "../../lib/barcode";
import { rupiah } from "../../lib/format";
import { newStoreBarcode, normalizeBarcode, variantLabel } from "../../../../shared/variants";
import type { ItemVariant } from "./types";

export interface DraftVariant {
  id?: string;
  opt1: string;
  opt2: string;
  price: number | "";
  cost: number | "";
  sku: string;
  barcode: string;
  stock: number | "";
  available: number;
}

export const toDraft = (v: ItemVariant): DraftVariant => ({
  id: v.id,
  opt1: v.opt1,
  opt2: v.opt2,
  price: v.price ?? "",
  cost: v.cost ?? "",
  sku: v.sku,
  barcode: v.barcode,
  stock: v.stock_qty,
  available: v.available,
});

export const fromDraft = (v: DraftVariant) => ({
  ...(v.id ? { id: v.id } : {}),
  opt1: v.opt1,
  opt2: v.opt2,
  price: v.price === "" ? null : v.price,
  cost: v.cost === "" ? null : v.cost,
  sku: v.sku,
  barcode: v.barcode,
  stock: v.stock === "" ? null : v.stock,
  available: v.available,
});

const split = (s: string) => [...new Set(s.split(",").map((x) => x.trim()).filter(Boolean))].slice(0, 20);
const key = (a: string, b: string) => `${a.toLowerCase()}|${b.toLowerCase()}`;

/** Kolom barcode dengan tombol scan kamera dan buat kode toko. */
export function BarcodeField({ id, value, onChange, label = "Barcode" }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  const [scan, setScan] = useState(false);
  return (
    <Field label={label} htmlFor={id} hint="Scan barcode pabrik di kemasan, atau buat kode toko lalu cetak labelnya.">
      <div className="row" style={{ gap: 6 }}>
        <input id={id} className="input num" inputMode="numeric" value={value} maxLength={64} onChange={(e) => onChange(normalizeBarcode(e.target.value))} placeholder="Mis. 8991234567890" />
        <button type="button" className="icon-btn" onClick={() => setScan(true)} aria-label="Scan barcode dengan kamera" title="Scan dengan kamera"><ScanLine /></button>
        <button type="button" className="icon-btn" onClick={() => onChange(newStoreBarcode())} aria-label="Buat kode barcode toko" title="Buat kode toko"><Wand2 /></button>
      </div>
      <CameraScanner open={scan} onClose={() => setScan(false)} onScan={onChange} title="Scan barcode produk" />
    </Field>
  );
}

export function VariantEditor({
  opt1Name,
  opt2Name,
  rows,
  basePrice,
  showStock,
  showCost,
  onChange,
}: {
  opt1Name: string;
  opt2Name: string;
  rows: DraftVariant[];
  basePrice: number | "";
  showStock: boolean;
  showCost: boolean;
  onChange: (v: { opt1Name: string; opt2Name: string; rows: DraftVariant[] }) => void;
}) {
  const [vals1, setVals1] = useState(() => [...new Set(rows.map((r) => r.opt1))].join(", "));
  const [vals2, setVals2] = useState(() => [...new Set(rows.map((r) => r.opt2).filter(Boolean))].join(", "));
  const [scanFor, setScanFor] = useState<number | null>(null);
  const [bulk, setBulk] = useState<number | "">("");

  // Susun ulang baris dari nilai pilihan, mempertahankan isian baris yang kombinasinya masih ada.
  const rebuild = (n1: string, n2: string, v1: string, v2: string) => {
    const a = split(v1);
    const b = n2.trim() ? split(v2) : [];
    const old = new Map(rows.map((r) => [key(r.opt1, r.opt2), r]));
    const next: DraftVariant[] = [];
    for (const x of a) {
      for (const y of b.length ? b : [""]) {
        next.push(old.get(key(x, y)) ?? { opt1: x, opt2: y, price: "", cost: "", sku: "", barcode: "", stock: "", available: 1 });
      }
    }
    onChange({ opt1Name: n1, opt2Name: n2, rows: next.slice(0, 100) });
  };
  const set = (i: number, patch: Partial<DraftVariant>) => onChange({ opt1Name, opt2Name, rows: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const total = rows.length;

  return (
    <div className="ve stack">
      <div className="form-row">
        <Field label="Pilihan 1" htmlFor="ve-n1" hint="Mis. Ukuran, Warna, atau Ukuran gelas">
          <input id="ve-n1" className="input" value={opt1Name} maxLength={20} onChange={(e) => onChange({ opt1Name: e.target.value, opt2Name, rows })} placeholder="Warna" />
        </Field>
        <Field label={`Isi ${opt1Name || "pilihan 1"}`} htmlFor="ve-v1" hint="Pisahkan dengan koma">
          <input id="ve-v1" className="input" value={vals1} onChange={(e) => { setVals1(e.target.value); rebuild(opt1Name, opt2Name, e.target.value, vals2); }} placeholder="Hitam, Putih, Navy" />
        </Field>
      </div>
      <div className="form-row">
        <Field label="Pilihan 2 (opsional)" htmlFor="ve-n2">
          <input id="ve-n2" className="input" value={opt2Name} maxLength={20} onChange={(e) => rebuild(opt1Name, e.target.value, vals1, vals2)} placeholder="Ukuran" />
        </Field>
        <Field label={`Isi ${opt2Name || "pilihan 2"}`} htmlFor="ve-v2" hint="Pisahkan dengan koma">
          <input id="ve-v2" className="input" value={vals2} disabled={!opt2Name.trim()} onChange={(e) => { setVals2(e.target.value); rebuild(opt1Name, opt2Name, vals1, e.target.value); }} placeholder="S, M, L, XL" />
        </Field>
      </div>

      {total > 0 && (
        <>
          <div className="row wrap between" style={{ gap: 8 }}>
            <span className="small strong">{total} varian</span>
            <div className="row wrap" style={{ gap: 6 }}>
              <div className="row" style={{ gap: 6 }}>
                <MoneyInput id="ve-bulk" value={bulk} onChange={setBulk} />
                <button type="button" className="btn btn-sm" disabled={bulk === ""} onClick={() => onChange({ opt1Name, opt2Name, rows: rows.map((r) => ({ ...r, price: bulk })) })}>Harga semua</button>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => onChange({ opt1Name, opt2Name, rows: rows.map((r) => (r.barcode ? r : { ...r, barcode: newStoreBarcode() })) })}>
                <Barcode /> Barcode untuk yang kosong
              </button>
            </div>
          </div>
          <div className="ve-list">
            {rows.map((r, i) => (
              <div key={key(r.opt1, r.opt2)} className={`ve-row${r.available ? "" : " off"}`}>
                <div className="ve-name">
                  <b>{variantLabel(r)}</b>
                  <Switch checked={!!r.available} onChange={(v) => set(i, { available: v ? 1 : 0 })} label={<span className="tiny">{r.available ? "Dijual" : "Tidak dijual"}</span>} />
                </div>
                <label className="ve-f">
                  <span>Harga</span>
                  <MoneyInput value={r.price} onChange={(v) => set(i, { price: v })} />
                  {r.price === "" && basePrice !== "" && <small>ikut {rupiah(Number(basePrice))}</small>}
                </label>
                {showCost && (
                  <label className="ve-f">
                    <span>Modal</span>
                    <MoneyInput value={r.cost} onChange={(v) => set(i, { cost: v })} />
                  </label>
                )}
                {showStock && (
                  <label className="ve-f">
                    <span>Stok</span>
                    <input className="input num" inputMode="numeric" value={r.stock} onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 7); set(i, { stock: d === "" ? "" : Number(d) }); }} />
                  </label>
                )}
                <label className="ve-f ve-code">
                  <span>Barcode</span>
                  <span className="row" style={{ gap: 4 }}>
                    <input className="input num" value={r.barcode} maxLength={64} onChange={(e) => set(i, { barcode: normalizeBarcode(e.target.value) })} aria-label={`Barcode ${variantLabel(r)}`} />
                    <button type="button" className="icon-btn" onClick={() => setScanFor(i)} aria-label={`Scan barcode ${variantLabel(r)}`}><ScanLine /></button>
                  </span>
                </label>
                <label className="ve-f">
                  <span>SKU</span>
                  <input className="input" value={r.sku} maxLength={40} onChange={(e) => set(i, { sku: e.target.value })} aria-label={`SKU ${variantLabel(r)}`} />
                </label>
              </div>
            ))}
          </div>
          <p className="hint">Harga kosong = ikut harga produk. Varian yang dihapus dari daftar diarsipkan; riwayat penjualannya tetap ada di laporan.</p>
        </>
      )}
      <CameraScanner open={scanFor !== null} onClose={() => setScanFor(null)} onScan={(c) => scanFor !== null && set(scanFor, { barcode: c })} title="Scan barcode varian" />
    </div>
  );
}
