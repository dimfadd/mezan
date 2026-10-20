import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AlertTriangle, BarChart3, Check, Pause, Play, Printer, RotateCcw, ScanLine, Shirt, ShoppingBag, Watch } from "lucide-react";
import { rupiah } from "../../../lib/format";
import { useCountUp, usePhase, useReducedMotion, useStepper, useVisible } from "./motion";

// Satu hari di toko baju: produk berukuran diisi, diberi label, discan di kasir, stok & laporan ikut bergerak.
// Label dan alurnya meniru layar mode toko barang yang sebenarnya.
type Key = "edit" | "label" | "scan" | "pay" | "stock" | "report";
const STEPS: { key: Key; who: string; title: string; body: string; dur: number; focus: "phone" | "board" }[] = [
  { key: "edit", who: "Pemilik", title: "Isi produk sekali, varian jadi sendiri", body: "Ketik warna dan ukurannya. Semua kombinasi langsung dibuat, masing-masing dengan harga dan stok sendiri.", dur: 4200, focus: "phone" },
  { key: "label", who: "Pemilik", title: "Pasang barcode", body: "Barang pabrik cukup discan barcode kemasannya. Belum ada? Buat kode, lalu cetak label tempel.", dur: 3600, focus: "phone" },
  { key: "scan", who: "Kasir", title: "Scan, langsung masuk keranjang", body: "Pakai alat scan atau kamera HP. Ukuran dan warnanya ikut terbaca, tidak perlu memilih lagi.", dur: 3600, focus: "board" },
  { key: "pay", who: "Kasir", title: "Terima bayar", body: "Tunai, QRIS, transfer, atau kartu. Kembalian dihitung sendiri, penjualan langsung selesai.", dur: 3600, focus: "board" },
  { key: "stock", who: "Pemilik", title: "Stok per ukuran berkurang sendiri", body: "Ukuran yang tinggal sedikit ditandai, yang habis tidak bisa dijual. Tidak perlu hitung manual di gudang.", dur: 3600, focus: "phone" },
  { key: "report", who: "Pemilik", title: "Untung hari ini kelihatan", body: "Omzet, untung, dan varian terlaris terbarui setiap transaksi. Bisa dilihat dari mana saja.", dur: 4200, focus: "phone" },
];
const at = (k: Key) => STEPS.findIndex((s) => s.key === k);

export function RetailStory() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const paused = userPaused ?? reduce;
  const visible = useVisible(root);
  const running = !paused && visible;
  const [step, setStep] = useStepper(STEPS.length, (s) => STEPS[s].dur, running);
  const s = STEPS[step];

  return (
    <div ref={root} className={`lp-story${running ? "" : " is-still"}`} data-focus={s.focus}>
      <ol className="lp-steps" aria-label="Langkah simulasi">
        {STEPS.map((x, i) => (
          <li key={x.key}>
            <button
              type="button"
              className={i === step ? "on" : i < step ? "done" : ""}
              aria-current={i === step ? "step" : undefined}
              onClick={() => setStep(i)}
              style={{ "--dur": `${x.dur}ms` } as CSSProperties}
            >
              <span className="who">{x.who}</span>
              <span className="t">{x.title}</span>
              <span className="b">{x.body}</span>
              <span className="bar" aria-hidden="true"><span /></span>
            </button>
          </li>
        ))}
      </ol>

      <div className="lp-stage">
        <div className="lp-stage-top">
          <span className="lp-sim-tag">Simulasi · langkah {step + 1} dari {STEPS.length}</span>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="icon-btn" onClick={() => setStep(0)} aria-label="Ulangi dari awal">
              <RotateCcw />
            </button>
            <button type="button" className="icon-btn" onClick={() => setUserPaused(!paused)} aria-label={paused ? "Putar animasi" : "Jeda animasi"}>
              {paused ? <Play /> : <Pause />}
            </button>
          </div>
        </div>
        <p className="lp-caption" aria-live="polite">
          <span className="who">{s.who}</span>
          <strong>{s.title}</strong>
          <span className="b">{s.body}</span>
        </p>
        <div className="lp-devices">
          <div className={`lp-dev lp-dev-phone${s.focus === "phone" ? " is-focus" : ""}`}>
            <span className="lp-dev-label">HP pemilik</span>
            <div className="lp-phone">
              <div className="lp-screen">
                <OwnerScreen k={s.key} step={step} running={running} />
              </div>
            </div>
          </div>
          <div className={`lp-dev lp-dev-board${s.focus === "board" ? " is-focus" : ""}`}>
            <span className="lp-dev-label">Layar kasir</span>
            <Till k={s.key} step={step} running={running} />
          </div>
        </div>
        <div className="lp-dots">
          {STEPS.map((x, i) => (
            <button
              type="button"
              key={x.key}
              className={i === step ? "on" : i < step ? "done" : ""}
              style={{ "--dur": `${x.dur}ms` } as CSSProperties}
              onClick={() => setStep(i)}
              aria-label={`Langkah ${i + 1}: ${x.title}`}
              aria-current={i === step ? "step" : undefined}
            >
              <span><span /></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Tap({ style }: { style?: CSSProperties }) {
  return <span className="lp-tap" aria-hidden="true" style={style} />;
}

/** Gambar produk sederhana: ikon di atas warna barangnya. */
export function Swatch({ icon, color, size = 34 }: { icon: ReactNode; color: string; size?: number }) {
  return (
    <span className="lp-sw" style={{ "--c": color, width: size, height: size } as CSSProperties}>
      {icon}
    </span>
  );
}

const COLORS = [
  ["Hitam", "#24262b"],
  ["Putih", "#f4f1ea"],
  ["Navy", "#2b3d63"],
] as const;
const SIZES = ["S", "M", "L", "XL"];

// ---------- HP pemilik ----------
function OwnerScreen({ k, step, running }: { k: Key; step: number; running: boolean }) {
  if (k === "edit") return <EditScreen running={running} />;
  if (k === "label") return <LabelScreen running={running} />;
  if (k === "report") return <ReportScreen running={running} />;
  return <StockScreen k={k} step={step} running={running} />;
}

function EditScreen({ running }: { running: boolean }) {
  const phase = usePhase("edit", [700, 1600, 2500], running);
  return (
    <div className="lp-rs">
      <div className="lp-rs-bar"><b>Tambah produk</b><span className="lp-badge">Draf</span></div>
      <div className="lp-rs-body">
        <div className="lp-rs-f"><small>Nama produk</small><b>Kaos Polos Katun</b></div>
        <div className="lp-rs-two">
          <div className="lp-rs-f"><small>Harga jual</small><b className="num">{rupiah(75000)}</b></div>
          <div className="lp-rs-f"><small>Modal per pcs</small><b className="num">{rupiah(42000)}</b></div>
        </div>
        <div className="lp-rs-sec">Varian & barcode</div>
        <div className="lp-rs-f">
          <small>Warna</small>
          <b>{phase >= 1 ? <span className="typed">Hitam, Putih, Navy</span> : <span className="lp-ph">Pisahkan dengan koma</span>}</b>
        </div>
        <div className="lp-rs-f">
          <small>Ukuran</small>
          <b>{phase >= 2 ? <span className="typed">S, M, L, XL</span> : <span className="lp-ph">Pisahkan dengan koma</span>}</b>
        </div>
        {phase >= 3 ? (
          <div className="lp-rs-grid" key="g">
            <span className="lp-badge ok"><Check /> 12 varian dibuat</span>
            <div className="cells">
              {COLORS.flatMap(([c, hex]) =>
                SIZES.map((z, i) => (
                  <span key={c + z} style={{ animationDelay: `${(COLORS.findIndex((x) => x[0] === c) * 4 + i) * 45}ms` }}>
                    <i style={{ background: hex }} />
                    {z}
                  </span>
                )),
              )}
            </div>
          </div>
        ) : (
          <p className="lp-rs-hint">Kombinasi warna × ukuran dibuat otomatis.</p>
        )}
      </div>
    </div>
  );
}

const LABELS = [
  { v: "Hitam / M", code: "2041736592018" },
  { v: "Putih / L", code: "2041736592025" },
  { v: "Navy / S", code: "2041736592032" },
];

function LabelScreen({ running }: { running: boolean }) {
  const phase = usePhase("label", [600, 1300, 2300], running);
  return (
    <div className="lp-rs">
      <div className="lp-rs-bar"><b>Cetak label barcode</b></div>
      <div className="lp-rs-body">
        <div className="lp-rs-labels">
          {LABELS.map((l, i) => (
            <div key={l.v} className={`lp-lbl${phase > i || phase >= 3 ? " in" : ""}`}>
              <b>Kaos Polos Katun</b>
              <span>{l.v} · {rupiah(75000)}</span>
              <span className="bars" aria-hidden="true" />
              <span className="num code">{l.code}</span>
            </div>
          ))}
        </div>
        <p className="lp-rs-hint">Ukuran label 50 × 30 mm. Muat di kertas A4 atau kertas stiker label.</p>
        <span className="lp-addbtn block">
          <Printer /> Cetak 12 label
          {phase === 2 && <Tap />}
        </span>
      </div>
    </div>
  );
}

function StockScreen({ k, step, running }: { k: Key; step: number; running: boolean }) {
  const phase = usePhase(k === "stock" ? "stock" : "s", k === "stock" ? [900] : [], running);
  const sold = step > at("stock") || (k === "stock" && phase >= 1);
  const m = sold ? 2 : 3;
  return (
    <div className="lp-rs">
      <div className="lp-rs-bar"><b>Stok</b><span className="lp-badge warn">{sold ? 2 : 1} menipis</span></div>
      <div className="lp-rs-body">
        {k === "stock" && phase >= 1 && (
          <div className="lp-rs-alert" key="a"><AlertTriangle /> Kaos Polos Hitam M tinggal 2. Saatnya pesan ulang.</div>
        )}
        <div className="lp-rs-card">
          <div className="lp-rs-prod">
            <Swatch icon={<Shirt />} color="#24262b" size={30} />
            <span className="grow"><b>Kaos Polos Katun</b><small>Hitam</small></span>
          </div>
          <div className="lp-rs-sizes">
            {SIZES.map((z) => {
              const n = z === "S" ? 4 : z === "M" ? m : z === "L" ? 6 : 0;
              return (
                <span key={z} className={`${n === 0 ? "out" : n <= 2 ? "low" : ""}${z === "M" && sold && k === "stock" ? " hit" : ""}`}>
                  {z}
                  <b className="num" key={n}>{n}</b>
                  <em>{n === 0 ? "habis" : n <= 2 ? "menipis" : "pcs"}</em>
                </span>
              );
            })}
          </div>
        </div>
        <div className="lp-rs-card">
          <div className="lp-rs-prod">
            <Swatch icon={<Shirt />} color="#2f5d8a" size={30} />
            <span className="grow"><b>Kemeja Flanel</b><small>Biru</small></span>
          </div>
          <div className="lp-rs-sizes">
            {[["M", 3], ["L", sold ? 4 : 5], ["XL", 2]].map(([z, n]) => (
              <span key={z} className={Number(n) <= 2 ? "low" : ""}>
                {z}
                <b className="num">{n}</b>
                <em>{Number(n) <= 2 ? "menipis" : "pcs"}</em>
              </span>
            ))}
          </div>
        </div>
        <div className="lp-rs-card row">
          <Swatch icon={<ShoppingBag />} color="#c9b48a" size={30} />
          <span className="grow"><b>Totebag Kanvas</b><small>tanpa varian</small></span>
          <b className="num">{sold ? 11 : 12} pcs</b>
        </div>
      </div>
    </div>
  );
}

function ReportScreen({ running }: { running: boolean }) {
  const phase = usePhase("report", [500], running);
  const omzet = useCountUp(phase >= 1 ? 2_680_000 : 2_415_000, running, 1200);
  const profit = useCountUp(phase >= 1 ? 1_148_000 : 1_030_000, running, 1200);
  const best: [string, string, number][] = [
    ["Kaos Polos Katun", "Hitam / M", 9],
    ["Kemeja Flanel", "Biru / L", 5],
    ["Totebag Kanvas", "", 4],
  ];
  return (
    <div className="lp-rs">
      <div className="lp-rs-bar"><b>Laporan · Hari ini</b><span className="lp-badge ok">Terbarui</span></div>
      <div className="lp-rs-body">
        <div className="lp-rs-kpis">
          <div><small>Omzet</small><b className="num">{rupiah(omzet)}</b></div>
          <div><small>Laba kotor</small><b className="num up">{rupiah(profit)}</b></div>
        </div>
        <div className="lp-rs-sec"><BarChart3 /> Varian terlaris</div>
        {best.map(([n, v, q], i) => (
          <div key={n} className="lp-rs-best">
            <span className="r num">{i + 1}</span>
            <span className="grow"><b>{n}</b>{v && <small>{v}</small>}</span>
            <b className="num">{q + (i === 0 && phase >= 1 ? 1 : 0)} pcs</b>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Layar kasir ----------
const GRID = [
  { n: "Kaos Polos Katun", p: "mulai " + rupiah(75000), c: "#24262b", icon: <Shirt />, v: "12 varian" },
  { n: "Kemeja Flanel", p: rupiah(145000), c: "#2f5d8a", icon: <Shirt />, v: "8 varian" },
  { n: "Totebag Kanvas", p: rupiah(45000), c: "#c9b48a", icon: <ShoppingBag /> },
  { n: "Jam Tangan Kulit", p: rupiah(189000), c: "#6b4f3a", icon: <Watch /> },
];
const LINES = [
  { n: "Kaos Polos Katun", v: "Hitam / M", p: 75000, code: "2041736592018" },
  { n: "Kemeja Flanel", v: "Biru / L", p: 145000, code: "2088104337452" },
  { n: "Totebag Kanvas", v: "", p: 45000, code: "8991002101234" },
];
const TOTAL = LINES.reduce((a, b) => a + b.p, 0);

function Till({ k, step, running }: { k: Key; step: number; running: boolean }) {
  const scanPhase = usePhase(k === "scan" ? "scan" : "a", k === "scan" ? [600, 1500, 2400] : [], running);
  const payPhase = usePhase(k === "pay" ? "pay" : "b", k === "pay" ? [700, 1500, 2400] : [], running);
  const shown = k === "scan" ? scanPhase : k === "pay" ? 3 : 0;
  const paid = (k === "pay" && payPhase >= 3) || step > at("pay");
  const sales = useCountUp(paid ? 2_680_000 : 2_415_000, running);
  const total = LINES.slice(0, shown).reduce((a, b) => a + b.p, 0);
  const lastCode = shown > 0 ? LINES[shown - 1].code : "";
  return (
    <div className="lp-board lp-till">
      <div className="lp-b-head">
        <b>Kasir</b>
        <span className="lp-kpi">
          <small>Penjualan hari ini</small>
          <b className={paid && k === "pay" ? "up" : ""}>{rupiah(sales)}</b>
        </span>
      </div>
      <div className="lp-till-in">
        <div className="lp-till-left">
          <div className={`lp-till-search${k === "scan" ? " live" : ""}`} key={k === "scan" ? `s${shown}` : "s"}>
            <ScanLine />
            {k === "scan" && shown > 0 ? <span className="num">{lastCode}</span> : <span className="lp-ph">Scan barcode atau cari barang</span>}
            {k === "scan" && <span className="laser" aria-hidden="true" />}
          </div>
          <div className="lp-till-grid">
            {GRID.map((g) => (
              <div key={g.n} className="lp-till-p">
                <Swatch icon={g.icon} color={g.c} />
                <b>{g.n}</b>
                <span className="num">{g.p}</span>
                {g.v && <em>{g.v}</em>}
              </div>
            ))}
          </div>
        </div>
        <div className="lp-till-cart">
          <small>Keranjang</small>
          {LINES.slice(0, shown).map((l) => (
            <div className="lp-till-line" key={l.n}>
              <span>{l.n}{l.v && <i>{l.v}</i>}</span>
              <b className="num">{rupiah(l.p)}</b>
            </div>
          ))}
          {shown === 0 && <div className="lp-col-empty">{paid ? "Penjualan berikutnya" : "Arahkan alat scan ke barcode"}</div>}
          <div className="lp-rt-tot"><span>Total</span><b className="num">{rupiah(total)}</b></div>
          <span className="lp-btn primary">Bayar{k === "pay" && payPhase === 0 && <Tap />}</span>
        </div>
      </div>
      {k === "pay" && payPhase >= 1 && (
        <div className="lp-till-pay">
          <div className="lp-till-modal">
            <b>Terima bayar {rupiah(TOTAL)}</b>
            <div className="lp-seg"><span className="on">Tunai</span><span>QRIS</span><span>Transfer</span><span>Kartu</span></div>
            <div className="lp-shift-row"><span>Uang diterima</span><b className="num">{payPhase >= 2 ? rupiah(300000) : "—"}</b></div>
            <div className="lp-shift-row tot"><span>Kembalian</span><b className="num">{payPhase >= 2 ? rupiah(300000 - TOTAL) : "—"}</b></div>
            {payPhase >= 3 ? (
              <span className="lp-btn done"><Check /> Lunas · stok terpotong</span>
            ) : (
              <span className="lp-btn primary">Selesai{payPhase === 2 && <Tap />}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
