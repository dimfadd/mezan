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
import "../../../styles/landing.css";

export function LandingPage() {
  const { solutions } = useSite();
  useScrollToHash();
  return (
    <div className="lp">
      <SiteNav />

      <header className="lp-hero">
        <h1>
          Pelanggan lihat dulu wujudnya, <span className="hl">baru pesan.</span>
        </h1>
        <p className="lead">
          Pesan.in memberi warung, kafe, dan resto kamu menu QR dengan foto dan video di setiap meja. Pesanan langsung masuk ke kasir dan dapur, pembeli tahu kapan pesanannya siap, dan laporan penjualan siap dibaca.
        </p>
        <div className="row wrap lp-cta">
          <Link className="btn btn-primary btn-lg" to="/daftar">Coba gratis 14 hari</Link>
          <a className="btn btn-lg" href="#simulasi"><ArrowDown aria-hidden="true" /> Lihat cara kerjanya</a>
          {import.meta.env.DEV && <a className="btn btn-ghost btn-lg" href="/m/contoh-meja1">Buka menu contoh</a>}
        </div>
        <ul className="lp-assure">
          <li><Check aria-hidden="true" /> Tanpa kartu kredit</li>
          <li><Check aria-hidden="true" /> Tanpa pasang aplikasi</li>
          <li><Check aria-hidden="true" /> Bisa mulai dari satu HP</li>
        </ul>
      </header>

      <section id="simulasi" className="lp-sec" aria-labelledby="sim-h">
        <div className="lp-sec-head">
          <h2 id="sim-h">Dari pindai QR sampai uang masuk</h2>
          <p>Satu pesanan dari Meja 4, dilihat dari dua sisi: HP pembeli dan layar kasir. Ketuk langkah mana saja untuk melompat.</p>
        </div>
        <Story />
      </section>

      <section id="mudah" className="lp-sec" aria-labelledby="mudah-h">
        <div className="lp-sec-head">
          <h2 id="mudah-h">Gampang, bahkan untuk yang baru pertama pakai aplikasi kasir</h2>
          <p>Banyak fitur bukan berarti rumit. Tiga langkah ini cukup untuk mulai menerima pesanan, sisanya bisa dinyalakan pelan-pelan.</p>
        </div>
        <EaseSteps />
      </section>

      <section id="antrean" className="lp-sec" aria-labelledby="eta-h">
        <div className="lp-sec-head">
          <h2 id="eta-h">Tidak ada lagi "masih lama, Kak?"</h2>
          <p>Pembeli melihat sendiri antrean dan perkiraan siapnya dari HP. Hitungannya memakai waktu saji tiap menu dan pesanan yang sedang dimasak, lalu diperbarui sendiri tanpa perlu dimuat ulang.</p>
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
          <h2 id="ops-h">Untung lebih jelas, kebocoran lebih sedikit</h2>
          <p>Tahu menu mana yang benar-benar menghasilkan, tawarkan pasangan yang pas, lalu jaga dapur, laci, dan pesanan tetap rapi, bahkan saat internet putus.</p>
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

      <Testimonials />

      <section id="paket" className="lp-sec" aria-labelledby="class-h">
        <div className="lp-sec-head">
          <h2 id="class-h">Cocok untuk gerobak sampai resto</h2>
          <p>Mulai dari template yang sudah rapi. Naik paket kalau usahanya tumbuh, datanya tetap.</p>
        </div>
        <div className="lp-classes">
          <article className="lp-class">
            <span className="who">Warung & kafe kecil</span>
            <h3>Langsung jalan hari ini</h3>
            <ul>
              <li><Check aria-hidden="true" /> Menu QR dengan template yang mudah dibaca di HP</li>
              <li><Check aria-hidden="true" /> Beberapa foto per menu, ditambah video di paket Kafe</li>
              <li><Check aria-hidden="true" /> Kasir, papan pesanan, stok, dan laporan</li>
              <li><Check aria-hidden="true" /> Bisa dipakai satu orang dari satu HP</li>
              <li><Check aria-hidden="true" /> Kasir tetap mencatat saat internet putus</li>
            </ul>
          </article>
          <article className="lp-class premium">
            <span className="who">Resto & kafe besar</span>
            <h3>Menu dengan wajah brand sendiri</h3>
            <ul>
              <li><Check aria-hidden="true" /> Warna, font, logo, dan gambar latar menu QR sendiri</li>
              <li><Check aria-hidden="true" /> Galeri lebih banyak foto dan video per menu</li>
              <li><Check aria-hidden="true" /> Lebih banyak meja dan akun karyawan</li>
            </ul>
          </article>
        </div>
        {solutions.length > 0 && (
          <nav className="lp-sol" aria-label="Solusi per jenis usaha">
            <span>Lihat yang paling pas untuk usahamu:</span>
            {solutions.map((s) => (
              <Link key={s.slug} className="chip" to={`/solusi/${s.slug}`}>{s.name} <ArrowRight aria-hidden="true" /></Link>
            ))}
          </nav>
        )}
      </section>

      <section className="lp-final receipt-edge" aria-labelledby="final-h">
        <div className="lp-final-in">
          <h2 id="final-h">Coba 14 hari, tanpa kartu kredit.</h2>
          <p>Daftar, isi menu, cetak QR meja. Akun karyawan bisa dibuat setelahnya.</p>
          <Link className="btn btn-primary btn-lg" to="/daftar">Daftarkan usaha</Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
