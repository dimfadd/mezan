import { useRef } from "react";
import { BarChart3, Camera, Check, LayoutList, MonitorSmartphone, Printer, Quote, Settings2 } from "lucide-react";
import { rupiah } from "../../../lib/format";
import { useSite } from "../../../lib/site";
import { FakeQR, Food } from "./art";
import { useCountUp, useReducedMotion, useStepper, useVisible } from "./motion";

// ---------- Cara mulai: tiga langkah ----------
export function EaseSteps() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const on = useVisible(root, 0.25) && !reduce;
  const [s] = useStepper(3, () => 2600, on);
  const step = on ? s : -1; // -1: semua langkah tampil sama, tanpa sorotan
  return (
    <div ref={root}>
      <ol className="ez-steps">
        <li className={step === 0 ? "on" : ""}>
          <span className="ez-no num">1</span>
          <div className="ez-art" aria-hidden="true">
            <div className="ez-form">
              <span className="ez-cam"><Camera /></span>
              <div className="ez-field"><small>Nama menu</small><b>Nasi Goreng</b></div>
              <div className="ez-field"><small>Harga</small><b className="num">{rupiah(18000)}</b></div>
            </div>
          </div>
          <h3>Daftar, lalu isi menu dari HP</h3>
          <p>Ketik nama dan harga, ambil foto langsung dari kamera. Tidak perlu komputer.</p>
        </li>
        <li className={step === 1 ? "on" : ""}>
          <span className="ez-no num">2</span>
          <div className="ez-art" aria-hidden="true">
            <div className="ez-qr">
              <FakeQR size={74} />
              <span>Meja 1</span>
            </div>
            <span className="ez-print"><Printer /> Cetak semua QR</span>
          </div>
          <h3>Cetak QR, tempel di meja</h3>
          <p>Setiap meja dapat kode sendiri. Cetak sekaligus dari halaman Meja.</p>
        </li>
        <li className={step === 2 ? "on" : ""}>
          <span className="ez-no num">3</span>
          <div className="ez-art" aria-hidden="true">
            <div className="ez-ticket">
              <div className="row between"><b className="num">#12</b><span className="lp-badge new">Baru</span></div>
              <span>2× Nasi Goreng · Meja 4</span>
              <span className="lp-btn ez-accept">
                Terima
                {step === 2 && <span className="lp-tap" style={{ animationDelay: "900ms" }} />}
              </span>
            </div>
          </div>
          <h3>Pesanan masuk, tinggal ketuk</h3>
          <p>Pesanan berbunyi di kasir. Ketuk Terima, lalu Siap. Pembeli melihat statusnya sendiri.</p>
        </li>
      </ol>
      <ul className="ez-points">
        <li><Check aria-hidden="true" /> Bahasa sehari-hari, bukan istilah akuntansi</li>
        <li><Check aria-hidden="true" /> Tanpa pasang aplikasi, langsung dari browser</li>
        <li><Check aria-hidden="true" /> Panduan langkah awal di dalam aplikasi</li>
        <li><Check aria-hidden="true" /> Jalan di HP, tablet, atau komputer yang sudah ada</li>
      </ul>
    </div>
  );
}

// ---------- Pantau usaha dari HP ----------
const HOURS = [
  [10, 3], [11, 7], [12, 14], [13, 11], [14, 5], [15, 6], [16, 8], [17, 10], [18, 15], [19, 18], [20, 12], [21, 6],
] as const;

export function Monitor() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const on = useVisible(root, 0.3) && !reduce;
  const [s] = useStepper(4, (i) => [1800, 1800, 1800, 2600][i], on);
  const step = on ? s : 3;
  const omzet = useCountUp([2_418_000, 2_476_000, 2_531_000, 2_590_000][step], on);
  const shown = on ? Math.min(HOURS.length, 8 + step) : HOURS.length; // jam berjalan, batang bertambah
  const max = Math.max(...HOURS.map((h) => h[1]));
  const peak = HOURS.reduce((a, b) => (b[1] > a[1] ? b : a));
  return (
    <div ref={root} className="mo">
      <div className="mo-visual" aria-hidden="true">
        <div className="mo-phone">
          <div className="mo-top">
            <small>Laporan · Hari ini</small>
            <span className="lp-badge ok">Terbarui</span>
          </div>
          <span className="mo-label">Omzet</span>
          <b className="mo-omzet num">{rupiah(omzet)}</b>
          <div className="mo-chips">
            <span><b className="num">{52 + step * 2}</b> Makan di tempat</span>
            <span><b className="num">{19 + step}</b> Bawa pulang</span>
            <span><b className="num">{34 + step * 2}</b> Lewat QR</span>
          </div>
          <div className="mo-chart">
            {HOURS.map(([h, n], i) => (
              <span key={h} className={i < shown ? (h === peak[0] ? "peak" : "") : "off"} style={{ height: `${(n / max) * 100}%` }} />
            ))}
          </div>
          <div className="mo-axis"><span>10.00</span><span>Paling ramai {peak[0]}.00</span><span>21.00</span></div>
          <div className="mo-best">
            <small>Terlaris</small>
            {(["geprek", "kopi", "nasgor"] as const).map((k, i) => (
              <div key={k}>
                <span className="th"><Food kind={k} /></span>
                <span className="n">{["Ayam Geprek", "Kopi Susu Gula Aren", "Nasi Goreng"][i]}</span>
                <b className="num">{[38, 31, 24][i] + (i === 0 ? step : 0)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mo-copy">
        <h2 id="pantau-h">Pantau usaha dari HP, di mana saja</h2>
        <p>Tidak perlu menunggu tutup toko untuk tahu hasil hari ini. Setiap transaksi langsung masuk ke laporan.</p>
        <ul className="mo-list">
          <li>
            <span className="ic"><LayoutList /></span>
            <span>Makan di tempat, bawa pulang, dan pesanan QR masuk ke satu papan.</span>
          </li>
          <li>
            <span className="ic"><Settings2 /></span>
            <span>Atur menu, harga, meja, dan karyawan langsung dari HP.</span>
          </li>
          <li>
            <span className="ic"><BarChart3 /></span>
            <span>Omzet, menu terlaris, dan jam ramai terbarui setiap ada transaksi.</span>
          </li>
          <li>
            <span className="ic"><MonitorSmartphone /></span>
            <span>Satu akun untuk HP pemilik, tablet kasir, dan layar dapur.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// ---------- Testimoni (hanya tampil kalau admin sudah menerbitkan testimoni asli) ----------
export function Testimonials() {
  const { testimonials } = useSite();
  if (!testimonials.length) return null;
  return (
    <section id="cerita" className="lp-sec" aria-labelledby="cerita-h">
      <div className="lp-sec-head">
        <h2 id="cerita-h">Cerita dari yang sudah memakai</h2>
        <p>Pemilik usaha yang menjalankan tokonya dengan Pesan.in.</p>
      </div>
      <div className={`ts-grid${testimonials.length === 1 ? " one" : ""}`}>
        {testimonials.map((t) => (
          <figure key={t.id} className="ts-card">
            <Quote aria-hidden="true" className="ts-q" />
            <blockquote>{t.quote}</blockquote>
            <figcaption>
              {t.photo_url ? (
                <img src={t.photo_url} alt="" loading="lazy" />
              ) : (
                <span className="ts-ini" aria-hidden="true">{t.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
              )}
              <span>
                <b>{t.name}</b>
                <small>{[t.role, t.business].filter(Boolean).join(", ")}{t.city ? ` · ${t.city}` : ""}</small>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

