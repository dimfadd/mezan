import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { BarChart3, Boxes, Check, Languages, Lock, Palette, Pause, Play, Printer, ShoppingBasket, Users } from "lucide-react";
import { rupiah } from "../../../lib/format";
import { DICT } from "../../../../../shared/i18n";
import { PRESETS, fontHref, normalizeTheme, themeVars } from "../../../../../shared/menuTheme";
import { Food, type FoodKind } from "./art";
import { useCountUp, useReducedMotion, useStepper, useVisible } from "./motion";

type DemoProps = { on: boolean };
const TAB_MS = 9000;

const TABS: { key: string; label: string; icon: ReactNode; title: string; body: string; points: string[]; Demo: (p: DemoProps) => ReactNode }[] = [
  {
    key: "kasir",
    label: "Kasir",
    icon: <ShoppingBasket />,
    title: "Yang datang langsung tetap tercatat",
    body: "Pesanan dari meja dan dari depan kasir masuk ke papan yang sama. Kasir tinggal ketuk menu, terima uang, dan kembalian dihitung sendiri.",
    points: ["Tunai, QRIS, transfer, atau kartu debit", "Struk ke printer thermal", "Nomor antrean harian otomatis"],
    Demo: PosDemo,
  },
  {
    key: "stok",
    label: "Stok",
    icon: <Boxes />,
    title: "Stok berkurang sendiri, menu habis tertutup sendiri",
    body: "Setiap pesanan memotong stok. Begitu habis, menu di HP pembeli langsung bertanda habis dan tidak bisa dipesan. Tidak butuh stok? Matikan saja.",
    points: ["Bisa dinyalakan per toko", "Catat stok masuk, rusak, dan koreksi", "Pesanan tidak bisa melebihi sisa stok"],
    Demo: StockDemo,
  },
  {
    key: "laporan",
    label: "Laporan",
    icon: <BarChart3 />,
    title: "Tahu menu mana yang laku, jam berapa ramai",
    body: "Omzet harian, menu terlaris, jam dan hari tersibuk, metode bayar, sampai menu yang tidak pernah dipesan. Karyawan tidak bisa membukanya.",
    points: ["Bandingkan dengan periode sebelumnya", "Unduh CSV untuk pembukuan", "Hanya untuk pemilik dan manajer"],
    Demo: ReportDemo,
  },
  {
    key: "brand",
    label: "Tampilan brand",
    icon: <Palette />,
    title: "Menu QR dengan wajah tokomu sendiri",
    body: "Warung kecil langsung pakai template yang sudah rapi. Resto dan kafe di paket premium bisa ganti warna, font, logo, dan gambar latar.",
    points: ["Lima gaya siap pakai untuk titik awal", "Kombinasi warna yang sulit dibaca ditolak", "Layar kasir tetap tampilan standar"],
    Demo: BrandDemo,
  },
  {
    key: "bahasa",
    label: "Dua bahasa",
    icon: <Languages />,
    title: "Tamu asing bisa pesan sendiri",
    body: "Pembeli bisa pindah ke bahasa Inggris dari menu. Nama asli masakan tetap tampil, versi Inggrisnya jadi keterangan. Catatan sampai ke dapur tetap dalam bahasa Indonesia.",
    points: ["Bahasa ikut setelan HP pembeli", "Isi versi Inggris boleh menyusul", "Pesan galat juga ikut bahasanya"],
    Demo: LangDemo,
  },
  {
    key: "akses",
    label: "Hak akses",
    icon: <Users />,
    title: "Satu toko, beberapa akun, akses sesuai peran",
    body: "Pemilik, manajer, dan karyawan masuk dengan akunnya sendiri. Karyawan cukup melihat pesanan dan kasir, sementara laporan dan harga hanya dibuka manajemen.",
    points: ["Dicek di server, bukan sekadar disembunyikan", "Ganti kata sandi karyawan dari menu Karyawan", "Jumlah akun sesuai paket"],
    Demo: RoleDemo,
  },
];

export function Features() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [auto, setAuto] = useState<boolean | null>(null);
  const playing = auto ?? !reduce;
  const visible = useVisible(root, 0.3);
  const running = playing && visible;
  const [tab, setTab] = useStepper(TABS.length, () => TAB_MS, running);
  const animate = visible && !reduce;
  const t = TABS[tab];
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const list = useRef<HTMLDivElement>(null);
  // Di HP deretan tab bisa digeser; pastikan tab aktif selalu kelihatan tanpa menggulir halaman.
  useEffect(() => {
    const l = list.current;
    const b = btns.current[tab];
    if (!l || !b) return;
    const left = b.offsetLeft - l.offsetLeft;
    if (left < l.scrollLeft || left + b.offsetWidth > l.scrollLeft + l.clientWidth) {
      l.scrollTo({ left: left - 8, behavior: reduce ? "auto" : "smooth" });
    }
  }, [tab, reduce]);

  const pick = (i: number) => {
    setTab(i);
    setAuto(false); // pengunjung memilih sendiri: berhenti berpindah otomatis
  };
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (tab + d + TABS.length) % TABS.length;
    pick(n);
    btns.current[n]?.focus();
  };

  return (
    <div ref={root} className={`lp-feat${animate ? "" : " is-still"}${running ? "" : " no-auto"}`}>
      <div className="lp-tabs-row">
        <div className="lp-tabs" ref={list} role="tablist" aria-label="Fitur" onKeyDown={onKey}>
          {TABS.map((x, i) => (
            <button
              key={x.key}
              ref={(el) => { btns.current[i] = el; }}
              type="button"
              role="tab"
              id={`lp-tab-${x.key}`}
              aria-selected={i === tab}
              aria-controls="lp-panel"
              tabIndex={i === tab ? 0 : -1}
              onClick={() => pick(i)}
              style={{ "--dur": `${TAB_MS}ms` } as CSSProperties}
            >
              {x.icon}
              {x.label}
              <span className="bar" aria-hidden="true"><span /></span>
            </button>
          ))}
        </div>
        <button type="button" className="icon-btn" onClick={() => setAuto(!playing)} aria-label={playing ? "Berhenti berpindah otomatis" : "Pindah tab otomatis"}>
          {playing ? <Pause /> : <Play />}
        </button>
      </div>
      <div className="lp-panel" role="tabpanel" id="lp-panel" aria-labelledby={`lp-tab-${t.key}`} key={t.key}>
        <div className="lp-panel-copy">
          <h3>{t.title}</h3>
          <p>{t.body}</p>
          <ul>
            {t.points.map((p) => (
              <li key={p}><Check aria-hidden="true" /> {p}</li>
            ))}
          </ul>
        </div>
        <div className="lp-panel-demo" aria-hidden="true">
          <t.Demo on={animate} />
        </div>
      </div>
    </div>
  );
}

// ---------- Kasir ----------
const POS_ITEMS: { name: string; price: number; food: FoodKind }[] = [
  { name: "Nasi Goreng Kampung", price: 22000, food: "nasgor" },
  { name: "Soto Ayam Lamongan", price: 17000, food: "soto" },
  { name: "Ayam Geprek", price: 18000, food: "geprek" },
  { name: "Es Teh Manis", price: 5000, food: "esteh" },
  { name: "Es Jeruk Peras", price: 8000, food: "jeruk" },
  { name: "Kopi Susu Gula Aren", price: 15000, food: "kopi" },
];

function PosDemo({ on }: DemoProps) {
  const [s] = useStepper(7, (i) => (i === 6 ? 2600 : 1150), on);
  const step = on ? s : 5;
  const lines: [string, number, number][] = [];
  if (step >= 1) lines.push(["Nasi Goreng Kampung", 1, 22000]);
  if (step >= 2) lines.push(["Es Teh Manis", step >= 3 ? 2 : 1, 5000]);
  const total = lines.reduce((a, [, q, p]) => a + q * p, 0);
  const tapped = step === 1 ? 0 : step === 2 || step === 3 ? 3 : -1;
  return (
    <div className="lp-pos lp-win">
      <div className="lp-pos-grid">
        {POS_ITEMS.map((it, i) => (
          <div key={it.name} className="lp-pos-item">
            <div className="th"><Food kind={it.food} /></div>
            <span className="n">{it.name}</span>
            <span className="p">{rupiah(it.price)}</span>
            {on && tapped === i && <span className="lp-tap" key={step} />}
          </div>
        ))}
      </div>
      <div className="lp-pos-side">
        <b className="h">Pesanan kasir</b>
        {lines.length === 0 && <span className="lp-col-empty">Ketuk menu untuk menambah.</span>}
        {lines.map(([n, q, p]) => (
          <div className="lp-pos-line" key={n}>
            <span className="q" key={q}>{q}×</span>
            <span>{n}</span>
            <b>{rupiah(q * p)}</b>
          </div>
        ))}
        <div className="lp-cart-total"><span>Total</span><b>{rupiah(total)}</b></div>
        {step >= 4 ? (
          <div className="lp-pay">
            <div className="lp-seg"><span className="on">Tunai</span><span>QRIS</span><span>Transfer</span></div>
            <div className="row between"><span>Uang diterima</span><b>{rupiah(50000)}</b></div>
            <div className="row between"><span>Kembalian</span><b className="hl">{rupiah(50000 - total)}</b></div>
            {step >= 5 ? (
              <span className="lp-btn done"><Printer aria-hidden="true" /> Lunas, cetak struk</span>
            ) : (
              <span className="lp-btn primary">Lunas {rupiah(total)}{on && <span className="lp-tap" />}</span>
            )}
          </div>
        ) : (
          <span className={`lp-btn primary${lines.length ? "" : " off"}`}>Bayar</span>
        )}
      </div>
    </div>
  );
}

// ---------- Stok ----------
function StockDemo({ on }: DemoProps) {
  const [s] = useStepper(5, (i) => (i === 4 ? 2400 : 1700), on);
  const step = on ? s : 2;
  const kerupuk = [4, 1, 0, 20, 20][step];
  const air = step >= 2 ? 35 : 36;
  const events = [
    null,
    "Pesanan #13 · 3× Kerupuk Udang",
    "Pesanan #14 · 1× Kerupuk Udang, 1× Air Mineral",
    "Stok masuk · +20 Kerupuk Udang dari pemasok",
    "Stok masuk · +20 Kerupuk Udang dari pemasok",
  ];
  const badge = (n: number) =>
    n === 0 ? <span className="lp-badge bad">Habis</span> : n <= 3 ? <span className="lp-badge warn">Tinggal {n}</span> : <span className="lp-badge ok">Aman</span>;
  return (
    <div className="lp-stock">
      <div className="lp-win">
        <div className="lp-win-h"><b>Stok</b><span className="lp-switch on"><i /> Pencatatan stok nyala</span></div>
        {events[step] && <div className="lp-event" key={step}>{events[step]}</div>}
        <table className="lp-table">
          <tbody>
            <tr className={step === 1 || step === 2 || step === 3 ? "hit" : ""} key={`k${step}`}>
              <td>Kerupuk Udang</td>
              <td className="num">{kerupuk}</td>
              <td>{badge(kerupuk)}</td>
            </tr>
            <tr className={step === 2 ? "hit" : ""} key={`a${step}`}>
              <td>Air Mineral 600 ml</td>
              <td className="num">{air}</td>
              <td>{badge(air)}</td>
            </tr>
            <tr>
              <td>Pisang Goreng Keju</td>
              <td className="num">12</td>
              <td>{badge(12)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="lp-mini-phone">
        <span className="cap">Menu di HP pembeli</span>
        <div className={`lp-m-item${kerupuk === 0 ? " out" : ""}`}>
          <div className="lp-m-thumb"><Food kind="kerupuk" /></div>
          <div className="lp-m-info">
            <span className="n">Kerupuk Udang</span>
            <span className="p">
              {rupiah(2000)}
              {kerupuk === 0 ? <em className="bad">Habis</em> : kerupuk <= 3 ? <em>Tinggal {kerupuk}</em> : null}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Laporan ----------
const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const SALES = [980, 1040, 930, 1120, 1250, 1690, 1402]; // ribu rupiah, total 8.412.000
const TOP: [string, number][] = [["Es Teh Manis", 140], ["Ayam Geprek Sambal Bawang", 96], ["Nasi Goreng Kampung", 81], ["Kopi Susu Gula Aren", 64]];

function ReportDemo({ on }: DemoProps) {
  const [s] = useStepper(8, () => 1300, on);
  const hi = on ? (s === 0 ? -1 : s - 1) : 5;
  const omzet = useCountUp(8412000, on, 1200);
  const orders = useCountUp(412, on, 1200);
  const max = Math.max(...SALES);
  return (
    <div className="lp-report lp-win">
      <div className="lp-win-h">
        <b>Laporan · 7 hari</b>
        <span className="lp-lock"><Lock aria-hidden="true" /> Pemilik & manajer</span>
      </div>
      <div className="lp-kpis">
        <div><small>Omzet</small><b>{rupiah(omzet)}</b><em className="up">+12% dari minggu lalu</em></div>
        <div><small>Pesanan</small><b>{orders}</b></div>
        <div><small>Rata-rata</small><b>{rupiah(20417)}</b></div>
      </div>
      <div className="lp-chart">
        {SALES.map((v, i) => (
          <div key={DAYS[i]} className={`lp-barcol${i === hi ? " hi" : ""}`}>
            {i === hi && <span className="tip">{DAYS[i]} · {rupiah(v * 1000)}</span>}
            <span className="b" style={{ height: `${(v / max) * 100}%`, animationDelay: `${i * 70}ms` }} />
            <span className="l">{DAYS[i]}</span>
          </div>
        ))}
      </div>
      <div className="lp-top">
        <small>Terlaris (porsi)</small>
        {TOP.map(([n, q]) => (
          <div key={n} className="lp-toprow">
            <span>{n}</span>
            <span className="track"><span style={{ width: `${(q / TOP[0][1]) * 100}%` }} /></span>
            <b>{q}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Tampilan brand ----------
const BRAND_NAMES: Record<string, string> = { kertas: "Warung Contoh", kopi: "Kopi Senja", malam: "Ruang Malam", laut: "Dapur Pesisir", bata: "Bakmi Bata" };
let fontsLoaded = false;

function BrandDemo({ on }: DemoProps) {
  const [s] = useStepper(PRESETS.length, () => 2600, on);
  const idx = on ? s : 1;
  useEffect(() => {
    if (fontsLoaded) return;
    fontsLoaded = true;
    const hrefs = new Set(PRESETS.map((p) => fontHref(normalizeTheme(p.theme))).filter(Boolean) as string[]);
    hrefs.forEach((href) => {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
      document.head.appendChild(l);
    });
  }, []);
  const p = PRESETS[idx];
  const theme = normalizeTheme(p.theme);
  const vars = themeVars(theme) as Record<string, string>;
  const { "color-scheme": scheme, ...rest } = vars;
  const grid = theme.layout === "grid";
  const items: [string, number, FoodKind][] = [["Bakmi Ayam", 24000, "nasgor"], ["Soto Betawi", 28000, "soto"], ["Es Kopi Susu", 18000, "kopi"], ["Teh Tarik", 12000, "teh"]];
  return (
    <div className="lp-brand">
      <div className="lp-presets">
        {PRESETS.map((x, i) => (
          <span key={x.id} className={i === idx ? "on" : ""}>
            <i style={{ background: normalizeTheme(x.theme).brand }} />
            {i === 0 ? "Template" : x.label}
          </span>
        ))}
      </div>
      <div className="lp-phone small">
        <div className="lp-screen lp-themed" style={{ ...(rest as CSSProperties), colorScheme: scheme }} key={p.id}>
          <div className="lp-th-head">
            <span className="logo">{BRAND_NAMES[p.id][0]}</span>
            <div>
              <div className="store">{BRAND_NAMES[p.id]}</div>
              <div className="tag">Meja 7</div>
            </div>
          </div>
          <div className="lp-th-sec">Makanan</div>
          <div className={`lp-th-list${grid ? " grid" : ""}`}>
            {items.map(([n, pr, f]) => (
              <div className="lp-th-card" key={n}>
                <div className="th"><Food kind={f} /></div>
                <div className="tx">
                  <span className="n">{n}</span>
                  <span className="p">{rupiah(pr)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="lp-th-cart">2 item · {rupiah(42000)}</div>
        </div>
      </div>
    </div>
  );
}

// ---------- Dua bahasa ----------
const LANG_ITEMS = [
  { id: "Ayam Geprek Sambal Bawang", en: "Smashed crispy chicken, garlic chili", d: ["Ayam tepung digeprek sambal bawang.", "Crispy chicken smashed into garlic chili."], price: 18000, food: "geprek" as const, tag: "pedas" },
  { id: "Soto Ayam Lamongan", en: "Turmeric chicken soup", d: ["Kuah kuning, suwiran ayam, koya.", "Clear yellow broth, shredded chicken."], price: 17000, food: "soto" as const },
];

function LangDemo({ on }: DemoProps) {
  const [s] = useStepper(2, () => 2800, on);
  const lang = (on ? s : 1) === 1 ? "en" : "id";
  const t = DICT[lang];
  return (
    <div className="lp-langdemo">
      <div className="lp-phone small">
        <div className="lp-screen lp-menu" key={lang}>
          <div className="lp-m-head">
            <div className="lp-m-top">
              <span className="lp-m-table">Meja 4</span>
              <span className="lp-m-lang"><Languages aria-hidden="true" /><b className={lang === "id" ? "" : "off"}>ID</b><b className={lang === "en" ? "" : "off"}>EN</b></span>
            </div>
            <div className="lp-m-store">Warung Contoh</div>
            <div className="lp-m-chips"><span className="on">{lang === "en" ? "Mains" : "Makanan"}</span><span>{lang === "en" ? "Drinks" : "Minuman"}</span></div>
          </div>
          <div className="lp-m-list">
            {LANG_ITEMS.map((m) => (
              <div key={m.id} className="lp-m-item">
                <div className="lp-m-thumb"><Food kind={m.food} /></div>
                <div className="lp-m-info">
                  <span className="n">{m.id}</span>
                  {lang === "en" && <span className="sub">{m.en}</span>}
                  <span className="d">{m.d[lang === "en" ? 1 : 0]}</span>
                  <span className="p">{rupiah(m.price)}{m.tag && <em>{t.tags[m.tag]}</em>}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="lp-quick pad">
            <span className="h">{t.quickNotes}</span>
            <div className="lp-qchips"><span className="on">{lang === "en" ? "Not spicy" : "Tidak pedas"}</span><span>{lang === "en" ? "No onion" : "Tanpa bawang"}</span></div>
          </div>
          <div className="lp-m-cart"><span>{t.items(2)}</span><b>{rupiah(35000)}</b><span className="go">{t.viewOrder}</span></div>
        </div>
      </div>
      <div className="lp-kitchen">
        <small>Yang terbaca di dapur</small>
        <div className="lp-ticket">
          <div className="lp-t-top"><div><b className="lp-t-no">#15</b><span className="lp-t-sub">Meja 4 · Emma</span></div></div>
          <ul><li><span className="q">1×</span><span>Ayam Geprek Sambal Bawang<em>Tidak pedas</em></span></li><li><span className="q">1×</span><span>Soto Ayam Lamongan</span></li></ul>
        </div>
      </div>
    </div>
  );
}

// ---------- Hak akses ----------
const ROLES = ["Pemilik", "Manajer", "Karyawan"] as const;
const PERMS: [string, number][] = [
  // angka = peran terendah yang boleh: 2 karyawan, 1 manajer, 0 pemilik saja
  ["Papan pesanan & kasir", 2],
  ["Tandai menu habis", 2],
  ["Lihat stok", 2],
  ["Ubah menu, harga, foto & video", 1],
  ["Laporan penjualan", 1],
  ["Meja & QR", 1],
  ["Akun karyawan", 1],
  ["Akun manajer", 0],
];

function RoleDemo({ on }: DemoProps) {
  const [s] = useStepper(3, () => 2600, on);
  const r = on ? s : 2;
  return (
    <div className="lp-roles lp-win">
      <div className="lp-seg">
        {ROLES.map((x, i) => <span key={x} className={i === r ? "on" : ""}>{x}</span>)}
      </div>
      <ul className="lp-perms">
        {PERMS.map(([p, min]) => {
          const ok = r <= min;
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
