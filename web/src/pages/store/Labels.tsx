import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, Printer } from "lucide-react";
import { Empty, Modal, useToast } from "../../components/ui";
import { BarcodeSvg } from "../../lib/barcode";
import { rupiah } from "../../lib/format";
import { variantLabel, variantPrice } from "../../../../shared/variants";
import type { MenuItem } from "./types";

interface Entry {
  key: string;
  name: string;
  variant: string;
  price: number;
  code: string;
  stock: number;
}

/**
 * Cetak label barcode untuk ditempel di barang. Ukuran label 50 × 30 mm, muat di kertas A4
 * maupun kertas label stiker. Barang tanpa barcode diberi kode dulu di form produk.
 */
export function LabelPrint({ open, items, onClose }: { open: boolean; items: MenuItem[]; onClose: () => void }) {
  const toast = useToast();
  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const i of items) {
      if (i.variants?.length) {
        for (const v of i.variants) if (v.barcode) out.push({ key: v.id, name: i.name, variant: variantLabel(v), price: variantPrice(i.price, v), code: v.barcode, stock: v.stock_qty });
      } else if (i.barcode) {
        out.push({ key: i.id, name: i.name, variant: "", price: i.price, code: i.barcode, stock: i.stock_qty });
      }
    }
    return out;
  }, [items]);
  const missing = items.reduce((n, i) => n + (i.variants?.length ? i.variants.filter((v) => !v.barcode).length : i.barcode ? 0 : 1), 0);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (open) setQty({});
  }, [open]);
  const total = Object.values(qty).reduce((a, b) => a + b, 0);
  const set = (k: string, n: number) => setQty((q) => ({ ...q, [k]: Math.max(0, Math.min(500, n)) }));

  useEffect(() => {
    if (!printing) return;
    const done = () => {
      document.body.classList.remove("printing-labels");
      setPrinting(false);
    };
    document.body.classList.add("printing-labels");
    window.addEventListener("afterprint", done, { once: true });
    // Beri waktu barcode tergambar sebelum dialog cetak terbuka.
    const t = window.setTimeout(() => window.print(), 400);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  const labels = entries.flatMap((e) => Array.from({ length: qty[e.key] ?? 0 }, (_, i) => ({ ...e, n: i })));

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        wide
        title="Cetak label barcode"
        footer={
          <>
            <button className="btn" onClick={onClose}>Tutup</button>
            <button className="btn btn-primary" disabled={!total} onClick={() => (total > 500 ? toast("Maksimal 500 label sekali cetak.", "error") : setPrinting(true))}>
              <Printer /> Cetak {total} label
            </button>
          </>
        }
      >
        {entries.length === 0 ? (
          <Empty title="Belum ada produk dengan barcode">Buka produk, lalu scan barcode kemasannya atau tekan tombol buat kode di kolom Barcode.</Empty>
        ) : (
          <div className="stack">
            <div className="row wrap" style={{ gap: 6 }}>
              <button type="button" className="btn btn-sm" onClick={() => setQty(Object.fromEntries(entries.map((e) => [e.key, Math.max(0, e.stock)])))}>Sebanyak stok</button>
              <button type="button" className="btn btn-sm" onClick={() => setQty(Object.fromEntries(entries.map((e) => [e.key, 1])))}>1 per barang</button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setQty({})}>Kosongkan</button>
            </div>
            <div className="lbl-list">
              {entries.map((e) => (
                <div key={e.key} className="lbl-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="strong">{e.name}{e.variant && <span className="variant-tag">{e.variant}</span>}</div>
                    <div className="tiny muted num">{e.code} · {rupiah(e.price)} · stok {e.stock}</div>
                  </div>
                  <div className="qty">
                    <button type="button" onClick={() => set(e.key, (qty[e.key] ?? 0) - 1)} aria-label={`Kurangi label ${e.name} ${e.variant}`}><Minus /></button>
                    <input className="num" inputMode="numeric" value={qty[e.key] ?? 0} onChange={(x) => set(e.key, Number(x.target.value.replace(/\D/g, "") || 0))} aria-label={`Jumlah label ${e.name} ${e.variant}`} />
                    <button type="button" onClick={() => set(e.key, (qty[e.key] ?? 0) + 1)} aria-label={`Tambah label ${e.name} ${e.variant}`}><Plus /></button>
                  </div>
                </div>
              ))}
            </div>
            {missing > 0 && <p className="hint">{missing} barang belum punya barcode, jadi tidak muncul di sini.</p>}
          </div>
        )}
      </Modal>
      {printing &&
        createPortal(
          <div id="label-print" aria-hidden="true">
            {labels.map((l) => (
              <div key={`${l.key}-${l.n}`} className="lbl">
                <span className="lbl-name">{l.name}</span>
                {l.variant && <span className="lbl-var">{l.variant}</span>}
                <span className="lbl-price">{rupiah(l.price)}</span>
                <BarcodeSvg code={l.code} height={30} width={1.3} fontSize={10} />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
