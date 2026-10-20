import { Check, ScanLine, UtensilsCrossed } from "lucide-react";
import { rupiah } from "../../../lib/format";
import { useStepper } from "./motion";

// Toko barang: scan barcode menambah varian yang tepat ke keranjang, stok per varian ikut terlihat.
const SCANS = [
  { name: "Kaos Polos", v: "Hitam / M", price: 75000, code: "2 041736 592018" },
  { name: "Kemeja Flanel", v: "Biru / L", price: 145000, code: "2 088104 337452" },
  { name: "Topi Baseball", v: "Krem", price: 55000, code: "2 019553 870316" },
];
const SIZES = [
  ["S", 4],
  ["M", 2],
  ["L", 6],
  ["XL", 0],
] as const;

export function RetailDemo({ on }: { on: boolean }) {
  const [s] = useStepper(5, (i) => [1500, 1500, 1500, 1500, 2600][i], on);
  const step = on ? s : 3;
  const shown = Math.min(step, SCANS.length);
  const scanning = step < SCANS.length ? SCANS[step] : null;
  const total = SCANS.slice(0, shown).reduce((n, x) => n + x.price, 0);
  return (
    <div className="lp-rt">
      <div className="lp-rt-scan">
        <small><ScanLine /> Scan barang</small>
        <div className={`lp-rt-code${scanning ? " on" : ""}`} key={step}>
          <span className="bars" aria-hidden="true" />
          <span className="laser" aria-hidden="true" />
          <span className="num">{(scanning ?? SCANS[SCANS.length - 1]).code}</span>
        </div>
        <div className="lp-rt-var">
          <small>Kaos Polos · Hitam</small>
          <div className="sizes">
            {SIZES.map(([z, n]) => (
              <span key={z} className={`${z === "M" && step >= 1 ? "on" : ""}${n === 0 ? " out" : ""}`}>
                {z}
                <em>{n === 0 ? "habis" : `sisa ${z === "M" && step >= 1 ? n - 1 : n}`}</em>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="lp-rt-cart">
        <small>Keranjang</small>
        {SCANS.slice(0, shown).map((x) => (
          <div className="lp-rt-line" key={x.name}>
            <span>
              {x.name} <i>{x.v}</i>
            </span>
            <b className="num">{rupiah(x.price)}</b>
          </div>
        ))}
        {shown === 0 && <div className="lp-col-empty">Arahkan alat scan ke barcode</div>}
        <div className="lp-rt-tot">
          <span>Total</span>
          <b className="num">{rupiah(total)}</b>
        </div>
        <span className={`lp-btn${step === 4 ? " done" : ""}`}>{step === 4 ? <><Check /> Lunas</> : "Bayar"}</span>
      </div>
    </div>
  );
}

// Makan dulu, bayar belakangan: pesanan satu meja menumpuk jadi satu tagihan, ditagih sekali.
const ORDERS = [
  { no: 12, at: "12.05", items: "2× Ayam Geprek, 2× Es Teh", total: 46000 },
  { no: 15, at: "12.31", items: "1× Pisang Goreng Keju", total: 10000 },
  { no: 18, at: "12.48", items: "2× Kopi Susu", total: 30000 },
];

export function BillDemo({ on }: { on: boolean }) {
  const [s] = useStepper(5, (i) => [1500, 1500, 1700, 1800, 2600][i], on);
  const step = on ? s : 3;
  const shown = Math.min(step + 1, ORDERS.length);
  const late = step >= 3;
  const paid = step === 4;
  const total = ORDERS.slice(0, shown).reduce((n, o) => n + o.total, 0);
  return (
    <div className={`lp-bill${late && !paid ? " late" : ""}${paid ? " paid" : ""}`}>
      <div className="lp-bill-h">
        <b><UtensilsCrossed /> Meja 4</b>
        {paid ? <span className="lp-badge ok"><Check /> Lunas</span> : late ? <span className="lp-badge bad">Diantar 35 menit, belum bayar</span> : <span className="lp-badge warn">Belum bayar</span>}
      </div>
      {ORDERS.slice(0, shown).map((o) => (
        <div className="lp-bill-row" key={o.no}>
          <span>
            <b className="num">#{o.no}</b> · {o.at}
            <em>{o.items}</em>
          </span>
          <span className="num">{rupiah(o.total)}</span>
        </div>
      ))}
      <div className="lp-bill-tot">
        <span>Total {shown} pesanan</span>
        <b className="num">{rupiah(total)}</b>
      </div>
      <span className="lp-btn">{paid ? "Tagihan selesai" : `Terima bayar ${rupiah(total)}`}</span>
    </div>
  );
}
