import { Link } from "react-router-dom";
import { ArrowDown, Check } from "lucide-react";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { useSession } from "../../../lib/session";
import { Story } from "./Story";
import { Features } from "./Features";
import { Extras } from "./Extras";
import { Ops } from "./Ops";
import "../../../styles/landing.css";

function homeFor(role?: string) {
  return role === "platform_admin" ? "/admin" : "/toko/pesanan";
}

export function LandingPage() {
  const { user } = useSession();
  return (
    <div className="lp">
      <nav className="lp-nav" aria-label="Utama">
        <span className="wordmark">pesan<span className="dot">.</span>in</span>
        <div className="row">
          {user ? (
            <Link className="btn btn-primary" to={homeFor(user.role)}>Buka dasbor</Link>
          ) : (
            <>
              <Link className="btn btn-ghost" to="/masuk">Masuk</Link>
              <Link className="btn btn-primary" to="/daftar">Daftarkan usaha</Link>
            </>
          )}
        </div>
      </nav>

      <header className="lp-hero">
        <h1>
          Pelanggan lihat dulu wujudnya, <span className="hl">baru pesan.</span>
        </h1>
        <p className="lead">
          Pesan.in memberi warung, kafe, dan resto kamu menu QR dengan foto dan video di setiap meja. Pesanan langsung masuk ke kasir dan dapur, stok berkurang sendiri, dan laporan penjualan siap dibaca.
        </p>
        <div className="row wrap lp-cta">
          <Link className="btn btn-primary btn-lg" to="/daftar">Coba gratis 14 hari</Link>
          <a className="btn btn-lg" href="#simulasi"><ArrowDown aria-hidden="true" /> Lihat cara kerjanya</a>
          {import.meta.env.DEV && <a className="btn btn-ghost btn-lg" href="/m/contoh-meja1">Buka menu contoh</a>}
        </div>
      </header>

      <section id="simulasi" className="lp-sec" aria-labelledby="sim-h">
        <div className="lp-sec-head">
          <h2 id="sim-h">Dari pindai QR sampai uang masuk</h2>
          <p>Satu pesanan dari Meja 4, dilihat dari dua sisi: HP pembeli dan layar kasir. Ketuk langkah mana saja untuk melompat.</p>
        </div>
        <Story />
      </section>

      <section className="lp-sec" aria-labelledby="feat-h">
        <div className="lp-sec-head">
          <h2 id="feat-h">Yang terjadi di belakang meja</h2>
          <p>Kasir, stok, laporan, sampai tampilan menu. Semuanya dari akun toko yang sama, di HP, tablet, atau komputer.</p>
        </div>
        <Features />
      </section>

      <section className="lp-sec" aria-labelledby="extra-h">
        <div className="lp-sec-head">
          <h2 id="extra-h">Hal kecil yang terasa di meja</h2>
          <p>Yang membuat pembeli betah dan kasir tidak kewalahan saat ramai.</p>
        </div>
        <Extras />
      </section>

      <section className="lp-sec" aria-labelledby="ops-h">
        <div className="lp-sec-head">
          <h2 id="ops-h">Yang menjaga dapur dan laci tetap rapi</h2>
          <p>Kasir yang tetap mencatat saat sinyal hilang, uang laci yang bisa dicocokkan, dapur yang tahu urutan, dan untung yang terlihat per menu.</p>
        </div>
        <Ops />
      </section>

      <section className="lp-sec" aria-labelledby="class-h">
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
      </section>

      <section className="lp-final receipt-edge" aria-labelledby="final-h">
        <div className="lp-final-in">
          <h2 id="final-h">Coba 14 hari, tanpa kartu kredit.</h2>
          <p>Daftar, isi menu, cetak QR meja. Akun karyawan bisa dibuat setelahnya.</p>
          <Link className="btn btn-primary btn-lg" to="/daftar">Daftarkan usaha</Link>
        </div>
      </section>

      <footer className="lp-foot">
        <span className="small muted">Pesan.in, menu QR dan kasir untuk warung, kafe, dan resto.</span>
        <div style={{ width: 240 }}><ThemeToggle /></div>
      </footer>
    </div>
  );
}
