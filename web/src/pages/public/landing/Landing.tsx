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
import { RetailKasirFeatures, RetailOwnerFeatures } from "./RetailDemos";
import { FloatingModeSwitch, MODE_OPTIONS, Slider, SUB_OPTIONS, useLandingMode, type Mode, type Sub } from "./mode";
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
  const { mode, sub, setMode, setSub } = useLandingMode();
  useScrollToHash();
  const h = HERO[mode];
  const retail = mode === "toko";
  const sols = solutions.filter((s) => s.slug.startsWith("toko") === retail);
  const signup = retail ? "/daftar?jenis=toko" : "/daftar";

  // Ganti dari pil melayang: bawa pengunjung ke awal isi mode baru, bukan ke tengah halaman yang sudah berubah.
  const toBody = () =>
    requestAnimationFrame(() => {
      const el = document.getElementById("lp-body");
      if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: "smooth" });
    });
  const switchFromFloat = (m: Mode) => {
    setMode(m);
    toBody();
  };
  const pickSub = (v: Sub) => {
    setSub(v);
    toBody();
  };

  return (
    <div className="lp">
      <SiteNav />

      <header className="lp-hero">
        <Slider id="lp-mode-main" className="lp-mode-main" value={mode} options={MODE_OPTIONS} onChange={setMode} label="Jenis usaha" />
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

      <div id="lp-body" className="lp-body">
        <div className="lp-subbar">
          <span className="lp-subbar-h">{retail ? "Lihat dari meja:" : "Lihat dari sisi:"}</span>
          <Slider key={mode} value={sub} options={SUB_OPTIONS[mode]} onChange={pickSub} label="Sudut pandang" compact className="lp-sub" />
        </div>
        <div className="lp-subbody" key={mode + sub}>
          {retail ? (sub === "depan" ? <RetailKasir /> : <RetailOwner />) : sub === "depan" ? <FoodBuyer /> : <FoodOwner />}
        </div>

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

function Head({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div className="lp-sec-head">
      <h2 id={id}>{title}</h2>
      <p>{children}</p>
    </div>
  );
}

/** Makanan & minuman, sisi pembeli: semua yang terjadi di HP pembeli. */
function FoodBuyer() {
  return (
    <>
      <section id="simulasi" className="lp-sec" aria-labelledby="sim-h">
        <Head id="sim-h" title="Dari pindai QR sampai makanan datang">Satu pesanan dari Meja 4, dilihat dari HP pembeli. Ketuk langkah mana saja untuk melompat.</Head>
        <Story side="pembeli" />
      </section>
      <section id="antrean" className="lp-sec" aria-labelledby="eta-h">
        <Head id="eta-h" title={'Tidak ada lagi "masih lama, Kak?"'}>Pembeli melihat sendiri antrean dan perkiraan siapnya dari HP. Hitungannya memakai waktu saji tiap menu dan pesanan yang sedang dimasak.</Head>
        <EtaSpotlight />
      </section>
      <section id="pembeli" className="lp-sec" aria-labelledby="extra-h">
        <Head id="extra-h" title="Yang membuat pembeli betah dan kembali">Menu yang hidup di layar, pelayan yang bisa dipanggil dari HP, dan stempel yang terkumpul setiap belanja.</Head>
        <Extras />
      </section>
      <section id="tampilan" className="lp-sec" aria-labelledby="tampil-h">
        <Head id="tampil-h" title="Menu dengan wajah tokomu, dalam dua bahasa">Warna, font, dan logo sendiri di paket premium. Tamu asing bisa pindah ke bahasa Inggris dari menu.</Head>
        <Features keys={["brand", "bahasa"]} />
      </section>
    </>
  );
}

/** Makanan & minuman, sisi pemilik & karyawan: kasir, dapur, laci, laporan. */
function FoodOwner() {
  return (
    <>
      <section id="kasir" className="lp-sec" aria-labelledby="kasir-h">
        <Head id="kasir-h" title="Pesanan masuk, dapur bergerak, uang tercatat">Pesanan yang sama dari Meja 4, kali ini dilihat dari layar kasir dan dapur.</Head>
        <Story side="usaha" />
      </section>
      <section id="mudah" className="lp-sec" aria-labelledby="mudah-h">
        <Head id="mudah-h" title="Gampang dipakai, bahkan yang baru pertama pegang aplikasi kasir">Tiga langkah ini cukup untuk mulai jualan. Fitur lain bisa dinyalakan pelan-pelan saat usaha tumbuh.</Head>
        <EaseSteps />
      </section>
      <section id="untung" className="lp-sec" aria-labelledby="ops-h">
        <Head id="ops-h" title="Untung lebih jelas, dapur dan laci lebih rapi">Tahu menu mana yang benar-benar menghasilkan, tagih meja yang makan dulu bayar belakangan, dan jaga dapur tetap lancar saat ramai.</Head>
        <Ops />
      </section>
      <section id="pantau" className="lp-sec" aria-labelledby="pantau-h">
        <Monitor />
      </section>
      <section id="fitur" className="lp-sec" aria-labelledby="feat-h">
        <Head id="feat-h" title="Dasar yang dipakai setiap hari">Kasir, stok, laporan, dan hak akses. Semuanya dari akun toko yang sama, di HP, tablet, atau komputer.</Head>
        <Features keys={["kasir", "stok", "laporan", "akses"]} />
      </section>
    </>
  );
}

/** Toko barang, sisi kasir: jualan sehari-hari. */
function RetailKasir() {
  return (
    <>
      <section id="simulasi-toko" className="lp-sec" aria-labelledby="simt-h">
        <Head id="simt-h" title="Scan, pilih ukuran, bayar">Satu pembeli di toko baju, dilihat dari layar kasir. Ketuk langkah mana saja untuk melompat.</Head>
        <RetailStory side="kasir" />
      </section>
      <section id="fitur-kasir" className="lp-sec" aria-labelledby="fk-h">
        <Head id="fk-h" title="Kasir tetap lancar, pelanggan punya alasan kembali">Jualan jalan saat sinyal hilang, tidak wajib beli alat scan, dan laci tercatat per shift.</Head>
        <RetailKasirFeatures />
      </section>
    </>
  );
}

/** Toko barang, sisi pemilik: produk, stok, laporan. */
function RetailOwner() {
  return (
    <>
      <section id="pemilik-toko" className="lp-sec" aria-labelledby="pt-h">
        <Head id="pt-h" title="Dari isi produk sampai untung terlihat">Yang diatur dan dipantau pemilik dari HP. Ketuk langkah mana saja untuk melompat.</Head>
        <RetailStory side="pemilik" />
      </section>
      <section id="mudah" className="lp-sec" aria-labelledby="mudah-h">
        <Head id="mudah-h" title="Gampang dipakai, bahkan yang baru pertama pegang aplikasi kasir">Tidak perlu komputer atau alat mahal. Tiga langkah ini cukup untuk mulai jualan hari ini.</Head>
        <EaseSteps retail />
      </section>
      <section id="fitur-toko" className="lp-sec" aria-labelledby="ft-h">
        <Head id="ft-h" title="Tahu barang mana yang menghasilkan">Modal per produk dan per varian, dan kasir tidak bisa mengubah harga.</Head>
        <RetailOwnerFeatures />
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
