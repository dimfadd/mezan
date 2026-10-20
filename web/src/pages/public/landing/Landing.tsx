import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, Check } from "lucide-react";
import { useScrollToHash, useSite } from "../../../lib/site";
import { Story } from "./Story";
import { Features } from "./Features";
import { Extras } from "./Extras";
import { Ops } from "./Ops";
import { EtaSpotlight } from "./Eta";
import { SiteNav } from "./SiteNav";
import { SiteFooter } from "./SiteFooter";
import { EaseSteps, Monitor, Testimonials } from "./Trust";
import { RetailStory } from "./RetailStory";
import { RetailFeatures } from "./RetailDemos";
import { FloatingModeSwitch, ModeSwitch, useLandingMode, type Mode } from "./mode";
import "../../../styles/landing.css";

const HERO: Record<Mode, { eyebrow: string; lead: string; demo: string; assure: string }> = {
  kuliner: {
    eyebrow: "Kasir & menu QR untuk usaha makanan dan minuman",
    lead: "Dari gerobak kaki lima, warung, kedai kopi, sampai resto. Pembeli memesan dari meja lewat menu QR berfoto dan video, kasir dan dapur menerimanya di layar yang sama, dan untung harian langsung terlihat.",
    demo: "#simulasi",
    assure: "UMKM bisa mulai dari satu HP",
  },
  toko: {
    eyebrow: "Kasir & stok untuk toko barang",
    lead: "Untuk toko baju, aksesoris, kelontong, sampai minimarket. Scan barcode pakai alat scan atau kamera HP, stok tiap ukuran dan warna berkurang sendiri, dan untung harian langsung terlihat.",
    demo: "#simulasi-toko",
    assure: "Kamera HP bisa jadi alat scan",
  },
};

export function LandingPage() {
  const { solutions } = useSite();
  const [mode, setMode] = useLandingMode();
  useScrollToHash();
  const h = HERO[mode];
  const retail = mode === "toko";
  const sols = solutions.filter((s) => s.slug.startsWith("toko") === retail);
  const signup = retail ? "/daftar?jenis=toko" : "/daftar";

  // Ganti dari pil melayang: bawa pengunjung ke awal isi mode baru, bukan ke tengah halaman yang sudah berubah.
  const switchFromFloat = (m: Mode) => {
    setMode(m);
    requestAnimationFrame(() => document.getElementById("lp-body")?.scrollIntoView({ behavior: "smooth" }));
  };

  return (
    <div className="lp">
      <SiteNav />

      <header className="lp-hero">
        <ModeSwitch id="lp-mode-main" mode={mode} onChange={setMode} />
        <span className="lp-eyebrow">{h.eyebrow}</span>
        <h1>
          Aplikasi kasir buat <span className="hl">UMKM</span> sampai bisnis besar.
        </h1>
        <p className="lead" key={mode}>{h.lead}</p>
        <div className="row wrap lp-cta">
          <Link className="btn btn-primary btn-lg" to={signup}>Coba gratis 14 hari</Link>
          <a className="btn btn-lg" href={h.demo}><ArrowDown aria-hidden="true" /> Lihat cara kerjanya</a>
          {import.meta.env.DEV && !retail && <a className="btn btn-ghost btn-lg" href="/m/contoh-meja1">Buka menu contoh</a>}
        </div>
        <ul className="lp-assure">
          <li><Check aria-hidden="true" /> Gratis 14 hari, tanpa kartu kredit</li>
          <li><Check aria-hidden="true" /> Tanpa pasang aplikasi</li>
          <li><Check aria-hidden="true" /> {h.assure}</li>
        </ul>
        {sols.length > 0 && (
          <nav className="lp-for" aria-label="Untuk jenis usaha">
            <span>Cocok untuk</span>
            {sols.map((s) => (
              <Link key={s.slug} to={`/solusi/${s.slug}`}>{s.name}</Link>
            ))}
          </nav>
        )}
      </header>

      <div id="lp-body" className="lp-body" key={mode}>
        {retail ? <RetailBody /> : <FoodBody />}

        <Testimonials />

        <section id="paket" className="lp-sec" aria-labelledby="class-h">
          <div className="lp-sec-head">
            <h2 id="class-h">{retail ? "Dari toko kecil sampai banyak kasir" : "Dari UMKM kaki lima sampai resto besar"}</h2>
            <p>Mulai kecil dengan yang perlu saja. Naik paket kalau usahanya tumbuh, datanya tetap.</p>
          </div>
          {retail ? <RetailClasses /> : <FoodClasses />}
          {sols.length > 0 && (
            <nav className="lp-sol" aria-label="Solusi per jenis usaha">
              <span>Lihat yang paling pas untuk usahamu:</span>
              {sols.map((s) => (
                <Link key={s.slug} className="chip" to={`/solusi/${s.slug}`}>{s.name} <ArrowRight aria-hidden="true" /></Link>
              ))}
            </nav>
          )}
        </section>
      </div>

      <section id="lp-end" className="lp-final receipt-edge" aria-labelledby="final-h">
        <div className="lp-final-in">
          <h2 id="final-h">UMKM bisa mulai hari ini.</h2>
          <p>Gratis 14 hari, tanpa kartu kredit. Daftar, isi {retail ? "produk" : "menu"}, lalu mulai jualan dari HP. Akun karyawan bisa dibuat setelahnya.</p>
          <Link className="btn btn-primary btn-lg" to={signup}>Daftarkan usaha</Link>
        </div>
      </section>

      <SiteFooter />
      <FloatingModeSwitch mode={mode} onChange={switchFromFloat} watch="lp-mode-main" />
    </div>
  );
}

function FoodBody() {
  return (
    <>
      <section id="simulasi" className="lp-sec" aria-labelledby="sim-h">
        <div className="lp-sec-head">
          <h2 id="sim-h">Dari pindai QR sampai uang masuk</h2>
          <p>Satu pesanan dari Meja 4, dilihat dari dua sisi: HP pembeli dan layar kasir. Ketuk langkah mana saja untuk melompat.</p>
        </div>
        <Story />
      </section>

      <section id="mudah" className="lp-sec" aria-labelledby="mudah-h">
        <div className="lp-sec-head">
          <h2 id="mudah-h">Gampang dipakai, bahkan yang baru pertama pegang aplikasi kasir</h2>
          <p>Tiga langkah ini cukup untuk mulai jualan. Fitur lain bisa dinyalakan pelan-pelan saat usaha tumbuh.</p>
        </div>
        <EaseSteps />
      </section>

      <section id="antrean" className="lp-sec" aria-labelledby="eta-h">
        <div className="lp-sec-head">
          <h2 id="eta-h">Tidak ada lagi "masih lama, Kak?"</h2>
          <p>Pembeli melihat sendiri antrean dan perkiraan siapnya dari HP. Hitungannya memakai waktu saji tiap menu dan pesanan yang sedang dimasak.</p>
        </div>
        <EtaSpotlight />
      </section>

      <section id="pembeli" className="lp-sec" aria-labelledby="extra-h">
        <div className="lp-sec-head">
          <h2 id="extra-h">Yang membuat pembeli betah dan kembali</h2>
          <p>Menu yang hidup di layar, pelayan yang bisa dipanggil dari HP, dan stempel yang terkumpul setiap belanja.</p>
        </div>
        <Extras />
      </section>

      <section id="untung" className="lp-sec" aria-labelledby="ops-h">
        <div className="lp-sec-head">
          <h2 id="ops-h">Untung lebih jelas, dapur dan laci lebih rapi</h2>
          <p>Tahu menu mana yang benar-benar menghasilkan, tagih meja yang makan dulu bayar belakangan, dan jaga dapur tetap lancar saat ramai.</p>
        </div>
        <Ops />
      </section>

      <section id="pantau" className="lp-sec" aria-labelledby="pantau-h">
        <Monitor />
      </section>

      <section id="fitur" className="lp-sec" aria-labelledby="feat-h">
        <div className="lp-sec-head">
          <h2 id="feat-h">Dasar yang dipakai setiap hari</h2>
          <p>Kasir, stok, laporan, sampai tampilan menu. Semuanya dari akun toko yang sama, di HP, tablet, atau komputer.</p>
        </div>
        <Features />
      </section>
    </>
  );
}

function RetailBody() {
  return (
    <>
      <section id="simulasi-toko" className="lp-sec" aria-labelledby="simt-h">
        <div className="lp-sec-head">
          <h2 id="simt-h">Dari isi produk sampai untung terlihat</h2>
          <p>Satu hari di toko baju, dilihat dari HP pemilik dan layar kasir. Ketuk langkah mana saja untuk melompat.</p>
        </div>
        <RetailStory />
      </section>

      <section id="mudah" className="lp-sec" aria-labelledby="mudah-h">
        <div className="lp-sec-head">
          <h2 id="mudah-h">Gampang dipakai, bahkan yang baru pertama pegang aplikasi kasir</h2>
          <p>Tidak perlu komputer atau alat mahal. Tiga langkah ini cukup untuk mulai jualan hari ini.</p>
        </div>
        <EaseSteps retail />
      </section>

      <section id="fitur-toko" className="lp-sec" aria-labelledby="ft-h">
        <div className="lp-sec-head">
          <h2 id="ft-h">Untung lebih jelas, kasir lebih rapi</h2>
          <p>Tahu barang mana yang benar-benar menghasilkan, jualan tetap jalan saat sinyal hilang, dan pelanggan punya alasan untuk kembali.</p>
        </div>
        <RetailFeatures />
      </section>

      <section id="pantau" className="lp-sec" aria-labelledby="pantau-h">
        <Monitor retail />
      </section>
    </>
  );
}

function FoodClasses() {
  return (
    <div className="lp-classes">
      <article className="lp-class">
        <span className="who">UMKM: kaki lima, warung, kedai</span>
        <h3>Langsung jualan hari ini</h3>
        <ul>
          <li><Check aria-hidden="true" /> Menu QR dengan template yang mudah dibaca di HP</li>
          <li><Check aria-hidden="true" /> Beberapa foto per menu, ditambah video di paket Kafe</li>
          <li><Check aria-hidden="true" /> Kasir, papan pesanan, stok, dan laporan</li>
          <li><Check aria-hidden="true" /> Bisa dipakai satu orang dari satu HP</li>
          <li><Check aria-hidden="true" /> Kasir tetap mencatat saat internet putus</li>
        </ul>
      </article>
      <article className="lp-class premium">
        <span className="who">Resto, kafe & bisnis besar</span>
        <h3>Rapi saat ramai, dengan wajah brand sendiri</h3>
        <ul>
          <li><Check aria-hidden="true" /> Warna, font, logo, dan gambar latar menu QR sendiri</li>
          <li><Check aria-hidden="true" /> Galeri lebih banyak foto dan video per menu</li>
          <li><Check aria-hidden="true" /> Lebih banyak meja dan akun karyawan</li>
          <li><Check aria-hidden="true" /> Layar dapur & bar, shift kasir, dan rekap laci</li>
        </ul>
      </article>
    </div>
  );
}

function RetailClasses() {
  return (
    <div className="lp-classes">
      <article className="lp-class">
        <span className="who">UMKM: toko baju, aksesoris, kelontong</span>
        <h3>Langsung jualan hari ini</h3>
        <ul>
          <li><Check aria-hidden="true" /> Kasir di HP, kamera HP bisa jadi alat scan</li>
          <li><Check aria-hidden="true" /> Varian ukuran & warna dengan stok sendiri</li>
          <li><Check aria-hidden="true" /> Buat kode barcode & cetak label tempel</li>
          <li><Check aria-hidden="true" /> Laporan omzet dan untung per produk</li>
          <li><Check aria-hidden="true" /> Kasir tetap mencatat saat internet putus</li>
        </ul>
      </article>
      <article className="lp-class premium">
        <span className="who">Minimarket & toko dengan banyak kasir</span>
        <h3>Rapi walau kasirnya bergantian</h3>
        <ul>
          <li><Check aria-hidden="true" /> Alat scan USB atau Bluetooth langsung terbaca</li>
          <li><Check aria-hidden="true" /> Lebih banyak akun karyawan, akses sesuai peran</li>
          <li><Check aria-hidden="true" /> Shift kasir dan rekap laci per orang</li>
          <li><Check aria-hidden="true" /> Kartu stempel untuk pelanggan tetap</li>
        </ul>
      </article>
    </div>
  );
}
