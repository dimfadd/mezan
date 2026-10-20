import { useRef, useState, type CSSProperties } from "react";
import { Bell, Check, Languages, Minus, Pause, Play, Plus, RotateCcw, Search, ShoppingBag, Utensils } from "lucide-react";
import { rupiah } from "../../../lib/format";
import { FakeQR, Food } from "./art";
import { useCountUp, usePhase, useReducedMotion, useStepper, useVisible } from "./motion";

// Satu cerita utuh: pembeli di Meja 4 memesan, kasir & dapur memprosesnya, uang masuk ke laporan.
// Semua label dan alur meniru layar aplikasi yang sebenarnya.
type Key = "scan" | "menu" | "detail" | "add" | "send" | "in" | "cook" | "pay";
type Step = { key: Key; who: string; title: string; body: string; dur: number };
export type StorySide = "pembeli" | "usaha";
// Sisi pembeli: semua yang dilihat di HP pembeli. Sisi usaha: yang dilihat kasir & dapur untuk pesanan yang sama.
const SIDES: Record<StorySide, Step[]> = {
  pembeli: [
    { key: "scan", who: "Pembeli", title: "Pindai QR di meja", body: "Menu langsung terbuka di browser HP. Tidak perlu pasang aplikasi.", dur: 3000 },
    { key: "menu", who: "Pembeli", title: "Lihat menu", body: "Harga, menu favorit, dan menu yang sedang habis kelihatan sejak awal.", dur: 2700 },
    { key: "detail", who: "Pembeli", title: "Ketuk, lihat wujudnya", body: "Geser foto dan video pendek. Ada porsi, isi piring, level pedas, dan lama penyajian.", dur: 4600 },
    { key: "add", who: "Pembeli", title: "Tambah dengan catatan", body: "Pilih jumlah dan catatan cepat seperti \"Pedas sedikit\".", dur: 3300 },
    { key: "send", who: "Pembeli", title: "Kirim pesanan", body: "Cukup isi nama. Bayarnya tetap di kasir.", dur: 2900 },
    { key: "in", who: "Pembeli", title: "Pesanan diterima", body: "Nomor antrean muncul di HP. Tidak perlu bolak-balik bertanya ke kasir.", dur: 3000 },
    { key: "cook", who: "Pembeli", title: "Pantau antrean & perkiraan siap", body: "Angkanya bergerak sendiri setiap dapur menyelesaikan pesanan di depannya.", dur: 3300 },
    { key: "pay", who: "Pembeli", title: "Diantar, lalu bayar", body: "Status berubah jadi Sudah dibayar begitu kasir menerima uangnya.", dur: 4400 },
  ],
  usaha: [
    { key: "in", who: "Kasir", title: "Pesanan masuk dan berbunyi", body: "Tiket dari meja muncul lengkap dengan nomor antrean, meja, dan catatan. Tidak ada yang salah dengar.", dur: 3600 },
    { key: "cook", who: "Dapur", title: "Terima, lalu buat", body: "Satu ketukan, pesanan pindah ke Sedang dibuat. HP pembeli ikut berubah sendiri.", dur: 3600 },
    { key: "pay", who: "Kasir", title: "Antar dan terima bayar", body: "Tunai, QRIS, atau transfer. Omzet hari ini langsung bertambah di laporan.", dur: 4600 },
  ],
};

export function Story({ side }: { side: StorySide }) {
  const STEPS = SIDES[side];
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const paused = userPaused ?? reduce;
  const visible = useVisible(root);
  const running = !paused && visible;
  const [step, setStep] = useStepper(STEPS.length, (s) => STEPS[s].dur, running);
  const s = STEPS[step];

  return (
    <div ref={root} className={`lp-story only-${side === "pembeli" ? "phone" : "board"}${running ? "" : " is-still"}`}>
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
        <div className="lp-devices single">
          {side === "pembeli" ? (
            <div className="lp-dev lp-dev-phone is-focus">
              <span className="lp-dev-label">HP pembeli</span>
              <div className="lp-phone">
                <div className="lp-screen">
                  <PhoneScreen k={s.key} running={running} />
                </div>
              </div>
            </div>
          ) : (
            <div className="lp-dev lp-dev-board is-focus">
              <span className="lp-dev-label">Layar kasir & dapur</span>
              <Board k={s.key} running={running} />
            </div>
          )}
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

// ---------- HP pembeli ----------
function PhoneScreen({ k, running }: { k: Key; running: boolean }) {
  if (k === "scan") return <ScanScreen running={running} />;
  if (k === "in" || k === "cook" || k === "pay") return <StatusScreen k={k} running={running} />;
  return <MenuScreen k={k} running={running} />;
}

function ScanScreen({ running }: { running: boolean }) {
  const phase = usePhase("scan", [1900], running);
  return (
    <div className="lp-scan">
      <div className="lp-tent">
        <span className="lp-tent-store">Warung Contoh</span>
        <FakeQR size={104} />
        <span className="lp-tent-table">Meja 4</span>
        <span className="lp-tent-hint">Pindai untuk lihat menu & pesan</span>
      </div>
      <div className="lp-finder" aria-hidden="true">
        <i /><i /><i /><i />
        <span className="lp-scanline" />
      </div>
      <div className={`lp-scan-pill${phase >= 1 ? " show" : ""}`}>
        <Check aria-hidden="true" /> Membuka menu Meja 4
      </div>
    </div>
  );
}

const MENU = [
  { name: "Nasi Goreng Kampung", desc: "Bumbu terasi, telur ceplok, kerupuk.", price: 22000, food: "nasgor" as const, tag: "Favorit" },
  { name: "Ayam Geprek Sambal Bawang", desc: "Ayam tepung digeprek sambal bawang.", price: 18000, food: "geprek" as const, tag: "Pedas", media: "3 foto · 1 video" },
  { name: "Soto Ayam Lamongan", desc: "Kuah kuning, suwiran ayam, koya.", price: 17000, food: "soto" as const },
  { name: "Mie Ayam Bakso", desc: "Mie kenyal, ayam kecap, bakso urat.", price: 20000, food: "nasgor" as const, out: true },
];

function MenuScreen({ k, running }: { k: Key; running: boolean }) {
  const menuPhase = usePhase(k === "menu" ? "menu" : "x", k === "menu" ? [1500] : [], running);
  const addPhase = usePhase(k === "add" ? "add" : "y", k === "add" ? [800, 1600, 2400] : [], running, k === "add" ? 2 : 0);
  const added = (k === "add" && addPhase >= 3) || k === "send";
  const sheet = k === "detail" || (k === "add" && addPhase < 3);
  return (
    <div className="lp-menu">
      <div className="lp-m-head">
        <div className="lp-m-top">
          <span className="lp-m-table"><Utensils aria-hidden="true" /> Meja 4</span>
          <span className="lp-m-lang"><Languages aria-hidden="true" /><b>ID</b><span>EN</span></span>
        </div>
        <div className="lp-m-store">Warung Contoh</div>
        <div className="lp-m-search"><Search aria-hidden="true" /> Cari menu</div>
        <div className="lp-m-chips"><span className="on">Makanan</span><span>Camilan</span><span>Minuman</span></div>
      </div>
      <div className="lp-m-list">
        {MENU.map((m) => (
          <div key={m.name} className={`lp-m-item${m.out ? " out" : ""}`}>
            <div className="lp-m-thumb"><Food kind={m.food} /></div>
            <div className="lp-m-info">
              <span className="n">{m.name}</span>
              <span className="d">{m.desc}</span>
              <span className="p">
                {rupiah(m.price)}
                {m.out ? <em className="bad">Habis</em> : m.tag ? <em>{m.tag}</em> : null}
              </span>
              {m.media && <span className="lp-m-media">{m.media}</span>}
            </div>
            {k === "menu" && menuPhase >= 1 && m.food === "geprek" && <Tap style={{ left: "45%", top: "50%" }} />}
          </div>
        ))}
      </div>
      <div className={`lp-m-cart${added ? " bump" : ""}`} key={added ? "a" : "b"}>
        <ShoppingBag aria-hidden="true" />
        <span>{added ? "4 item" : "2 item"}</span>
        <b>{rupiah(added ? 52000 : 16000)}</b>
        <span className="go">Lihat pesanan</span>
      </div>
      {sheet && <DishSheet k={k} phase={addPhase} />}
      {k === "send" && <CartSheet running={running} />}
    </div>
  );
}

function DishSheet({ k, phase }: { k: Key; phase: number }) {
  const qty = k === "add" && phase >= 1 ? 2 : 1;
  const chip = k === "add" && phase >= 2;
  return (
    <div className={`lp-sheet${k === "add" ? " scrolled" : ""}`}>
      <div className="lp-sheet-body">
        <div className="lp-gal">
          <div className="lp-gal-track">
            <div className="lp-gal-slide"><Food kind="geprek" /></div>
            <div className="lp-gal-slide"><Food kind="geprek" view={1} /></div>
            <div className="lp-gal-slide lp-gal-video">
              <Food kind="geprek" view={1} />
              <span className="lp-vid-bar"><span /></span>
              <span className="lp-vid-tag">Video 8 dtk</span>
            </div>
          </div>
          <div className="lp-gal-dots"><span /><span /><span className="v" /></div>
        </div>
        <div className="lp-dish">
          <div className="lp-dish-title">
            <span>Ayam Geprek Sambal Bawang</span>
            <b>{rupiah(18000)}</b>
          </div>
          <div className="lp-facts">
            <span>1 orang</span>
            <span>±12 menit</span>
            <span className="lp-chili" aria-label="Pedas sekali, level 4 dari 5">
              {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= 4 ? "on" : ""} />)} Pedas sekali
            </span>
          </div>
          <div className="lp-get">
            <span className="h">Yang kamu dapat</span>
            <ul><li>Nasi putih</li><li>Ayam goreng tepung</li><li>Sambal bawang</li><li>Lalapan</li></ul>
          </div>
          <div className="lp-quick">
            <span className="h">Catatan untuk dapur</span>
            <div className="lp-qchips">
              <span>Tidak pedas</span>
              <span className={chip ? "on" : ""}>
                Pedas sedikit
                {k === "add" && phase === 1 && <Tap />}
              </span>
              <span>Tanpa bawang</span>
            </div>
          </div>
          <div className="lp-addrow">
            <span className="lp-stepper">
              <Minus aria-hidden="true" />
              <b key={qty} className="pop">{qty}</b>
              <span className="plus">
                <Plus aria-hidden="true" />
                {k === "add" && phase === 0 && <Tap />}
              </span>
            </span>
            <span className="lp-addbtn">
              Tambah · {rupiah(18000 * qty)}
              {k === "add" && phase === 2 && <Tap />}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartSheet({ running }: { running: boolean }) {
  const phase = usePhase("send", [700, 1700, 2300], running, 1);
  return (
    <div className="lp-sheet lp-cart">
      <div className="lp-sheet-body">
        <div className="lp-cart-h">Pesanan Meja 4</div>
        <div className="lp-cart-line">
          <span className="q">2×</span>
          <span>Ayam Geprek Sambal Bawang<em>Pedas sedikit</em></span>
          <b>{rupiah(36000)}</b>
        </div>
        <div className="lp-cart-line">
          <span className="q">2×</span>
          <span>Es Jeruk Peras</span>
          <b>{rupiah(16000)}</b>
        </div>
        <div className="lp-cart-total"><span>Total</span><b>{rupiah(52000)}</b></div>
        <div className="lp-field">
          <span className="h">Nama kamu</span>
          <span className="lp-input">{phase >= 1 ? <span className="typed">Sari</span> : <span className="ph">Mis. Andi</span>}</span>
        </div>
        <p className="lp-fine">Pembayaran dilakukan di kasir.</p>
        <span className={`lp-addbtn block${phase >= 3 ? " busy" : ""}`}>
          {phase >= 3 ? "Mengirim..." : "Kirim pesanan"}
          {phase === 2 && <Tap />}
        </span>
      </div>
    </div>
  );
}

const STATUS = [
  ["Pesanan terkirim", "Menunggu kasir menerima."],
  ["Sedang dibuat", "Dapur sedang menyiapkan pesananmu."],
  ["Siap diantar", "Sebentar lagi sampai di meja."],
  ["Sudah diantar", "Selamat makan."],
];

function StatusScreen({ k, running }: { k: Key; running: boolean }) {
  const payPhase = usePhase(k === "pay" ? "pay" : "z", k === "pay" ? [1000, 2200] : [], running);
  const idx = k === "in" ? 0 : k === "cook" ? 1 : payPhase >= 2 ? 3 : 2;
  const paid = k === "pay" && payPhase >= 2;
  return (
    <div className="lp-status">
      <div className="lp-st-head">
        <span className="lp-st-no">Pesanan #12</span>
        <span className="lp-st-sub">Meja 4 · Sari · 12:41</span>
        <span className={`lp-badge ${paid ? "ok" : "warn"}`}>{paid ? "Sudah dibayar" : "Bayar di kasir"}</span>
      </div>
      {idx < 2 && (
        <div className="lp-st-eta" key={idx}>
          <span className="pill">Antrean ke-2</span>
          <span>Perkiraan siap <b>{idx === 0 ? "10–14" : "7–10"} menit</b></span>
        </div>
      )}
      <ol className="lp-st-steps">
        {STATUS.map(([t, b], i) => (
          <li key={t} className={i < idx ? "done" : i === idx ? "on" : ""}>
            <span className="dot">{i < idx ? <Check aria-hidden="true" /> : null}</span>
            <span>
              <b>{t}</b>
              {i === idx && <small>{b}</small>}
            </span>
          </li>
        ))}
      </ol>
      <div className="lp-st-items">
        <div><span>2× Ayam Geprek Sambal Bawang</span><em>Pedas sedikit</em></div>
        <div><span>2× Es Jeruk Peras</span></div>
        <div className="tot"><span>Total</span><b>{rupiah(52000)}</b></div>
      </div>
    </div>
  );
}

// ---------- Papan pesanan kasir ----------
function Board({ k, running }: { k: Key; running: boolean }) {
  const inPhase = usePhase(k === "in" ? "in" : "a", k === "in" ? [2100] : [], running);
  const cookPhase = usePhase(k === "cook" ? "cook" : "b", k === "cook" ? [2100] : [], running);
  const payPhase = usePhase(k === "pay" ? "pay" : "c", k === "pay" ? [1000, 2200] : [], running);
  const arrived = k === "in" || k === "cook" || k === "pay";
  const col = !arrived ? null : k === "in" ? "new" : k === "cook" ? "prep" : "ready";
  const paid = k === "pay" && payPhase >= 2;
  const omzet = useCountUp(paid ? 590000 : 538000, running);
  const lunas = paid ? 11 : 10;

  const ticket12 = (
    <div className={`lp-ticket${k === "in" ? " is-new" : ""}`} key={col ?? "none"}>
      <div className="lp-t-top">
        <div>
          <b className="lp-t-no">#12</b>
          <span className="lp-t-sub">Meja 4 · Sari</span>
        </div>
        {k === "in" ? (
          <span className="lp-badge new"><Bell aria-hidden="true" className="ring" /> Baru</span>
        ) : (
          <span className="lp-badge info">QR meja</span>
        )}
      </div>
      <ul>
        <li><span className="q">2×</span><span>Ayam Geprek Sambal Bawang<em>Pedas sedikit</em></span></li>
        <li><span className="q">2×</span><span>Es Jeruk Peras</span></li>
      </ul>
      <div className="lp-t-foot">
        <b>{rupiah(52000)}</b>
        <span className={`lp-badge ${paid ? "ok" : "warn"}`}>{paid ? "Lunas · QRIS" : "Belum bayar"}</span>
      </div>
      <div className="lp-t-acts">
        {k === "in" && (
          <>
            <span className="lp-btn primary">Terima & buat{inPhase >= 1 && <Tap />}</span>
            <span className="lp-btn">Tolak</span>
          </>
        )}
        {k === "cook" && <span className="lp-btn primary">Siap diantar{cookPhase >= 1 && <Tap />}</span>}
        {k === "pay" && !paid && <span className="lp-btn primary">Terima bayar{payPhase >= 1 && <Tap />}</span>}
        {k === "pay" && paid && <span className="lp-btn done"><Check aria-hidden="true" /> Uang diterima</span>}
      </div>
    </div>
  );

  const ticket11 = (
    <div className="lp-ticket">
      <div className="lp-t-top">
        <div>
          <b className="lp-t-no">#11</b>
          <span className="lp-t-sub">Meja 2 · Budi</span>
        </div>
        <span className="lp-badge">Kasir</span>
      </div>
      <ul>
        <li><span className="q">1×</span><span>Soto Ayam Lamongan</span></li>
        <li><span className="q">1×</span><span>Teh Tarik</span></li>
      </ul>
    </div>
  );

  const cols = [
    { key: "new", title: "Baru masuk" },
    { key: "prep", title: "Sedang dibuat" },
    { key: "ready", title: "Siap / belum bayar" },
  ];
  const count = (c: string) => (c === "prep" ? 1 : 0) + (col === c ? 1 : 0);
  const focusCol = col ?? "new";

  return (
    <div className="lp-board">
      <div className="lp-b-head">
        <b>Pesanan</b>
        <span className="lp-kpi">
          <small>Omzet hari ini</small>
          <b className={paid ? "up" : ""}>{rupiah(omzet)}</b>
        </span>
        <span className="lp-kpi">
          <small>Lunas</small>
          <b>{lunas}</b>
        </span>
      </div>
      <div className="lp-b-tabs" aria-hidden="true">
        {cols.map((c) => (
          <span key={c.key} className={c.key === focusCol ? "on" : ""}>{c.title.split(" ")[0]} ({count(c.key)})</span>
        ))}
      </div>
      <div className="lp-b-cols">
        {cols.map((c) => (
          <div key={c.key} className={`lp-col${c.key === focusCol ? " is-focus" : ""}`}>
            <div className="lp-col-h">{c.title} <span>{count(c.key)}</span></div>
            {c.key === "prep" && ticket11}
            {col === c.key && ticket12}
            {count(c.key) === 0 && <div className="lp-col-empty">Kosong</div>}
          </div>
        ))}
      </div>
      {paid && (
        <div className="lp-toast" role="status">
          <Check aria-hidden="true" /> {rupiah(52000)} diterima lewat QRIS
        </div>
      )}
    </div>
  );
}
