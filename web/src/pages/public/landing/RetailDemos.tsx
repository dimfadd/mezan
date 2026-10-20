import { useRef } from "react";
import { Calculator, Camera, Check, Clock3, Lock, ScanLine, Shirt, Stamp, UserCog, UtensilsCrossed, Wallet, WifiOff } from "lucide-react";
import { rupiah } from "../../../lib/format";
import { useReducedMotion, useStepper, useVisible } from "./motion";
import { Card } from "./Extras";
import { MarginDemo, OfflineDemo, ShiftDemo } from "./Ops";
import { StampDemo } from "./MoreDemos";
import { Swatch } from "./RetailStory";

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

// ---------- Fitur toko barang: sisi kasir ----------
export function RetailKasirFeatures() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const on = useVisible(root, 0.15) && !reduce;
  return (
    <div ref={root} className={`lp-bento${on ? "" : " is-still"}`}>
      <Card className="span2" icon={<WifiOff />} title="Kasir tetap jalan saat internet putus" body="Penjualan disimpan di perangkat dan dikirim sendiri begitu sinyal kembali. Scan barcode juga tetap jalan.">
        <OfflineDemo on={on} />
      </Card>
      <Card icon={<Camera />} title="Kamera HP jadi alat scan" body="Belum punya alat scan? Arahkan kamera HP ke barcode. Sudah punya alat scan USB atau Bluetooth? Langsung bisa dipakai.">
        <CameraDemo on={on} />
      </Card>
      <Card icon={<Stamp />} title="Kartu stempel pelanggan" body="Kasir mengetik nomor HP saat bayar. Belanja di atas batas minimal dapat stempel, hadiahnya ditukar di kasir.">
        <StampDemo on={on} reward="Potongan Rp20.000" />
      </Card>
      <Card icon={<Clock3 />} title="Simpan dulu, bayar nanti" body="Pelanggan langganan ambil barang dulu? Simpan penjualannya, lalu tagih dari daftar Belum dibayar.">
        <PayLaterDemo on={on} />
      </Card>
      <Card icon={<Wallet />} title="Shift kasir & rekap laci" body="Buka dengan modal awal, hitung uang saat tutup. Selisihnya langsung terlihat, lengkap dengan siapa yang bertugas.">
        <ShiftDemo on={on} spend="beli kantong plastik" />
      </Card>
    </div>
  );
}

// ---------- Fitur toko barang: sisi pemilik ----------
export function RetailOwnerFeatures() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const on = useVisible(root, 0.15) && !reduce;
  return (
    <div ref={root} className={`lp-bento${on ? "" : " is-still"}`}>
      <Card className="span2" icon={<Calculator />} title="Modal & untung per produk" body="Isi modal per pcs, per varian kalau perlu. Laporan memilah produk jadi Andalan, Laris tapi tipis, Untung tapi jarang, dan Perlu dievaluasi.">
        <MarginDemo on={on} retail />
      </Card>
      <Card icon={<UserCog />} title="Akun kasir terpisah" body="Kasir hanya bisa berjualan dan melihat stok. Harga, modal, dan laporan hanya untuk pemilik dan manajer.">
        <RolesDemo on={on} />
      </Card>
    </div>
  );
}

/** Kamera HP membaca barcode, barang langsung masuk keranjang. */
function CameraDemo({ on }: { on: boolean }) {
  const [s] = useStepper(3, (i) => [1400, 1300, 2400][i], on);
  const step = on ? s : 2;
  return (
    <div className="lp-cam">
      <div className="lp-cam-view">
        <div className="lp-cam-tag">
          <b>Kaos Polos · Hitam / M</b>
          <span className="bars" aria-hidden="true" />
        </div>
        <span className="lp-cam-frame" aria-hidden="true"><i /><i /><i /><i /></span>
        {step === 1 && <span className="laser" aria-hidden="true" />}
      </div>
      <div className={`lp-cam-pill${step === 2 ? " show" : ""}`}>
        <Check /> Masuk keranjang · {rupiah(75000)}
      </div>
    </div>
  );
}

const PERMS: [string, boolean][] = [
  ["Kasir & scan barang", true],
  ["Lihat stok", true],
  ["Ubah harga & modal", false],
  ["Laporan & untung", false],
];

function RolesDemo({ on }: { on: boolean }) {
  const [s] = useStepper(2, () => 2600, on);
  const owner = on ? s === 0 : false;
  return (
    <div className="lp-roles lp-win">
      <div className="lp-seg">
        <span className={owner ? "on" : ""}>Pemilik</span>
        <span className={owner ? "" : "on"}>Kasir</span>
      </div>
      <ul className="lp-perms">
        {PERMS.map(([p, staff]) => {
          const ok = owner || staff;
          return (
            <li key={p} className={ok ? "ok" : "no"}>
              {ok ? <Check aria-hidden="true" /> : <Lock aria-hidden="true" />}
              <span>{p}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const LATER = [
  { who: "Bu Rina", what: "2 Kaos Polos", total: 150000, days: "kemarin" },
  { who: "Toko Sinar", what: "6 Kaus Kaki", total: 90000, days: "hari ini" },
];

function PayLaterDemo({ on }: { on: boolean }) {
  const [s] = useStepper(3, (i) => [1800, 1600, 2600][i], on);
  const step = on ? s : 0;
  const paid = step === 2;
  return (
    <div className="lp-later">
      <div className="lp-later-h"><b>Belum dibayar</b><span className="lp-badge warn">{paid ? 1 : 2}</span></div>
      {LATER.map((l, i) => (
        <div key={l.who} className={`lp-later-row${i === 0 && paid ? " paid" : ""}`}>
          <Swatch icon={<Shirt />} color={i === 0 ? "#24262b" : "#8a6f4e"} size={26} />
          <span className="grow"><b>{l.who}</b><small>{l.what} · {l.days}</small></span>
          {i === 0 && paid ? (
            <span className="lp-badge ok"><Check /> Lunas</span>
          ) : (
            <span className="lp-btn" style={{ flex: "none" }}>
              {rupiah(l.total)}
              {i === 0 && step === 1 && <span className="lp-tap" />}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
