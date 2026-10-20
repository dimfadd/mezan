import { useEffect, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight, BarChart3, BellRing, Boxes, Cake, Calculator, Check, ChefHat, Clapperboard, Clock3, Coffee, DoorOpen, QrCode, ReceiptText,
  Sandwich, ScanLine, Shirt, ShoppingBag, Soup, Sparkles, Stamp, Star, Store, Timer, Users, UserCog, Utensils, Wallet, WifiOff, Wallet2,
} from "lucide-react";
import { useSite } from "../../lib/site";
import { FEATURES, RETAIL_FEATURE_HREF, type FeatureKey, type SolutionIcon } from "../../../../shared/site";
import { SiteNav } from "./landing/SiteNav";
import { SiteFooter } from "./landing/SiteFooter";
import "../../styles/landing.css";

export const SOLUTION_ICON: Record<SolutionIcon, ReactNode> = {
  coffee: <Coffee />,
  utensils: <Utensils />,
  store: <Store />,
  cake: <Cake />,
  soup: <Soup />,
  sandwich: <Sandwich />,
  shirt: <Shirt />,
  bag: <ShoppingBag />,
};

export const FEATURE_ICON: Record<FeatureKey, ReactNode> = {
  qr: <QrCode />,
  eta: <Timer />,
  video: <Clapperboard />,
  call: <BellRing />,
  group: <Users />,
  split: <ReceiptText />,
  stamp: <Stamp />,
  rating: <Star />,
  waitlist: <DoorOpen />,
  takeaway: <ShoppingBag />,
  pairs: <Sparkles />,
  happy: <Clock3 />,
  margin: <Calculator />,
  kds: <ChefHat />,
  offline: <WifiOff />,
  shift: <Wallet />,
  pos: <Wallet2 />,
  stock: <Boxes />,
  reports: <BarChart3 />,
  staff: <UserCog />,
  variants: <Shirt />,
  barcode: <ScanLine />,
  bills: <ReceiptText />,
};

/** Huruf kecil untuk dipakai di tengah kalimat, tapi singkatan seperti UMKM tetap kapital. */
const lc = (n: string) => (/^[A-Z]{2}/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1));

export function SolutionPage() {
  const { slug = "" } = useParams();
  const { solutions } = useSite();
  const s = solutions.find((x) => x.slug === slug);
  useEffect(() => {
    document.title = s ? `${s.name} · Pesan.in` : "Pesan.in";
    window.scrollTo(0, 0);
  }, [s]);

  return (
    <div className="lp">
      <SiteNav />
      {!s ? (
        <section className="lp-sec sol-missing">
          <h1>Halaman ini tidak ditemukan</h1>
          <p className="muted">Mungkin alamatnya berubah. Pilih jenis usaha di bawah, atau kembali ke beranda.</p>
          <div className="row wrap" style={{ justifyContent: "center" }}>
            {solutions.map((x) => <Link key={x.slug} className="chip" to={`/solusi/${x.slug}`}>{x.name}</Link>)}
            <Link className="btn" to="/">Beranda</Link>
          </div>
        </section>
      ) : (
        <>
          <header className="sol-hero">
            <span className="sol-tag"><span className="ic">{SOLUTION_ICON[s.icon]}</span> Untuk {lc(s.name)}</span>
            <h1>{s.headline}</h1>
            {s.intro && <p className="lead">{s.intro}</p>}
            <div className="row wrap lp-cta">
              <Link className="btn btn-primary btn-lg" to="/daftar">Coba gratis 14 hari</Link>
              <Link className="btn btn-lg" to="/#simulasi">Lihat cara kerjanya</Link>
            </div>
          </header>

          {s.points.length > 0 && (
            <section className="lp-sec" aria-labelledby="sol-pts">
              <div className="lp-sec-head">
                <h2 id="sol-pts">Yang biasanya merepotkan, kini lebih ringan</h2>
              </div>
              <ul className="sol-points">
                {s.points.map((p) => (
                  <li key={p}><span className="ic"><Check /></span><span>{p}</span></li>
                ))}
              </ul>
            </section>
          )}

          {s.features.length > 0 && (
            <section className="lp-sec" aria-labelledby="sol-feat">
              <div className="lp-sec-head">
                <h2 id="sol-feat">Fitur yang paling terpakai di {lc(s.name)}</h2>
                <p>Ketuk salah satu untuk melihat peragaannya.</p>
              </div>
              <div className="sol-feats">
                {s.features.filter((k) => FEATURES[k]).map((k) => (
                  <Link key={k} className="sol-feat" to={(s.slug.startsWith("toko") && RETAIL_FEATURE_HREF[k]) || FEATURES[k].href}>
                    <span className="ic">{FEATURE_ICON[k]}</span>
                    <b>{FEATURES[k].title}</b>
                    <span>{FEATURES[k].desc}</span>
                    <span className="go">Lihat peragaan <ArrowRight aria-hidden="true" /></span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="lp-final receipt-edge" aria-labelledby="sol-final">
            <div className="lp-final-in">
              <h2 id="sol-final">Siap mencoba Pesan.in?</h2>
              <p>Gratis 14 hari, tanpa kartu kredit. Mulai dari satu HP, tambah tablet kasir dan layar dapur kapan saja.</p>
              <Link className="btn btn-primary btn-lg" to="/daftar">Daftarkan usaha</Link>
            </div>
          </section>

          {solutions.length > 1 && (
            <nav className="lp-sol" aria-label="Jenis usaha lain">
              <span>Jenis usaha lain:</span>
              {solutions.filter((x) => x.slug !== s.slug).map((x) => (
                <Link key={x.slug} className="chip" to={`/solusi/${x.slug}`}>{x.name} <ArrowRight aria-hidden="true" /></Link>
              ))}
            </nav>
          )}
        </>
      )}
      <SiteFooter />
    </div>
  );
}

