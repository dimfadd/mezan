import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BRAND, LEGAL, copyrightYears } from "../../lib/legal";

// Halaman hukum. Isinya ditulis mengikuti data yang benar-benar disimpan aplikasi ini;
// kalau fitur yang menyentuh data berubah, perbarui juga halaman ini dan tanggalnya.

function Contact() {
  return LEGAL.email ? (
    <p>
      Hubungi {LEGAL.operator} melalui email <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
    </p>
  ) : (
    <p>Hubungi {LEGAL.operator} melalui kontak resmi yang tercantum di dasbor toko atau di halaman ini saat sudah tersedia.</p>
  );
}

function LegalLayout({ title, intro, sections }: { title: string; intro: ReactNode; sections: [string, string, ReactNode][] }) {
  useEffect(() => {
    document.title = `${title} · ${BRAND}`;
    window.scrollTo(0, 0);
  }, [title]);
  return (
    <div className="legal">
      <header className="legal-head">
        <Link className="wordmark" to="/">pesan<span className="dot">.</span>in</Link>
        <Link className="btn btn-ghost btn-sm" to="/"><ArrowLeft /> Beranda</Link>
      </header>
      <main className="legal-main">
        <h1>{title}</h1>
        <p className="muted small">Berlaku sejak {LEGAL.updated}</p>
        <div className="legal-intro">{intro}</div>
        <nav className="legal-toc" aria-label="Daftar isi">
          <ol>
            {sections.map(([id, h]) => (
              <li key={id}><a href={`#${id}`}>{h}</a></li>
            ))}
          </ol>
        </nav>
        {sections.map(([id, h, body], i) => (
          <section key={id} id={id} aria-labelledby={`${id}-h`}>
            <h2 id={`${id}-h`}>{i + 1}. {h}</h2>
            {body}
          </section>
        ))}
      </main>
      <LegalFoot />
    </div>
  );
}

export function TermsPage() {
  const court = LEGAL.city ? `Pengadilan Negeri ${LEGAL.city}` : "pengadilan negeri yang berwenang di Indonesia";
  return (
    <LegalLayout
      title="Syarat & Ketentuan"
      intro={
        <p>
          Syarat ini mengatur pemakaian {BRAND} (aplikasi menu QR, kasir, dapur, dan laporan) yang disediakan oleh {LEGAL.operator}. Dengan mendaftar atau memakai {BRAND}, kamu
          menyetujui syarat ini. "Pemilik usaha" berarti pemilik akun toko beserta karyawannya. "Pembeli" berarti orang yang memesan lewat menu QR toko.
        </p>
      }
      sections={[
        ["akun", "Akun dan karyawan", (
          <ul>
            <li>Isi data pendaftaran dengan benar dan jaga kerahasiaan kata sandi.</li>
            <li>Pemilik usaha bertanggung jawab atas semua tindakan yang dilakukan lewat akun toko, termasuk akun karyawan yang dibuatnya.</li>
            <li>Segera ganti kata sandi dan beri tahu kami kalau ada akses yang tidak kamu kenali.</li>
          </ul>
        )],
        ["langganan", "Masa coba dan langganan", (
          <ul>
            <li>Toko baru mendapat masa coba 14 hari tanpa kartu kredit.</li>
            <li>Setelah itu, fitur dan batas (meja, karyawan, foto, video) mengikuti paket yang dipilih. Harga paket tercantum di dasbor toko.</li>
            <li>Kalau langganan tidak diperpanjang, toko masih bisa dipakai selama 3 hari masa tenggang, lalu terkunci. Data tidak langsung dihapus dan kembali terbuka setelah langganan diperpanjang.</li>
          </ul>
        )],
        ["konten", "Konten dan data milik usaha", (
          <ul>
            <li>Menu, foto, video, logo, dan catatan penjualan yang kamu masukkan tetap milikmu.</li>
            <li>Kamu memberi kami izin terbatas untuk menyimpan, memproses, dan menampilkan konten itu hanya untuk menjalankan layanan, misalnya menampilkan menu ke pembeli.</li>
            <li>Kamu menjamin berhak memakai semua foto, video, dan merek yang kamu unggah, dan konten itu tidak melanggar hukum atau hak orang lain.</li>
          </ul>
        )],
        ["hki", "Hak cipta dan merek Pesan.in", (
          <>
            <p>
              Perangkat lunak, kode sumber, desain antarmuka, alur fitur, animasi simulasi, ilustrasi, teks, serta nama dan logo {BRAND} adalah milik {LEGAL.operator} dan dilindungi
              Undang-Undang No. 28 Tahun 2014 tentang Hak Cipta dan Undang-Undang No. 20 Tahun 2016 tentang Merek dan Indikasi Geografis.
            </p>
            <p>Langganan memberimu hak pakai yang terbatas, tidak eksklusif, dan tidak dapat dialihkan selama langganan aktif. Langganan tidak memindahkan kepemilikan apa pun.</p>
          </>
        )],
        ["larangan", "Yang tidak boleh dilakukan", (
          <ul>
            <li>Menyalin, mengunduh massal, atau meniru tampilan, teks, animasi, maupun alur {BRAND} untuk produk lain.</li>
            <li>Membongkar, merekayasa balik, atau mencoba mengambil kode sumber, kecuali yang diizinkan undang-undang.</li>
            <li>Mengambil data secara otomatis (scraping, bot) dari halaman atau API {BRAND} tanpa izin tertulis.</li>
            <li>Menjual kembali, menyewakan, atau membagikan akses akun kepada usaha lain.</li>
            <li>Melewati batas paket, pengaman lokasi, atau sistem keamanan, atau mengganggu kerja layanan.</li>
            <li>Memakai {BRAND} untuk menjual barang terlarang, menipu, atau mengirim pesan yang tidak diminta (spam) ke pembeli.</li>
            <li>Menghapus atau menutupi tanda hak cipta dan merek {BRAND}.</li>
          </ul>
        )],
        ["pembeli", "Data pembeli", (
          <>
            <p>
              Untuk data pembeli di tokonya (nama di pesanan, nomor HP untuk kartu stempel, antrean, dan struk), pemilik usaha adalah pengendali data, dan {BRAND} memproses
              data itu atas nama pemilik usaha, sesuai Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.
            </p>
            <p>Pemilik usaha hanya boleh memakai nomor HP pembeli untuk keperluan yang pembeli setujui di tokonya, dan wajib melayani permintaan pembeli untuk melihat atau menghapus datanya.</p>
          </>
        )],
        ["tanggung-jawab", "Ketersediaan dan batas tanggung jawab", (
          <ul>
            <li>Kami berusaha agar layanan selalu tersedia, tetapi gangguan, pemeliharaan, atau putusnya internet bisa terjadi. Kasir offline membantu, tetapi tidak menjamin semua fitur berjalan tanpa internet.</li>
            <li>Perkiraan siap, saran pasangan menu, pengaman lokasi, dan laporan adalah alat bantu. Angkanya perkiraan dan bisa berbeda dari kenyataan.</li>
            <li>Sejauh diizinkan hukum, kami tidak bertanggung jawab atas kerugian tidak langsung, seperti kehilangan keuntungan. Tanggung jawab kami paling banyak sebesar biaya langganan yang kamu bayar dalam 3 bulan terakhir.</li>
            <li>Pemilik usaha tetap bertanggung jawab atas harga, pajak, makanan, dan pelayanan kepada pembelinya.</li>
          </ul>
        )],
        ["berhenti", "Penghentian", (
          <ul>
            <li>Kamu bisa berhenti berlangganan kapan saja.</li>
            <li>Kami dapat menangguhkan atau menutup akun yang melanggar syarat ini, terutama pelanggaran hak cipta, keamanan, atau hukum. Kalau memungkinkan, kami memberi tahu dulu.</li>
          </ul>
        )],
        ["perubahan", "Perubahan syarat", <p>Kalau syarat ini berubah, tanggal di bagian atas diperbarui dan perubahan penting kami umumkan di dasbor toko. Memakai layanan setelah itu berarti menyetujui syarat yang baru.</p>],
        ["hukum", "Hukum yang berlaku", <p>Syarat ini tunduk pada hukum Republik Indonesia. Perselisihan diselesaikan lebih dulu secara musyawarah. Kalau tidak tercapai kesepakatan, diselesaikan di {court}.</p>],
        ["kontak", "Kontak", <Contact />],
      ]}
    />
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Kebijakan Privasi"
      intro={
        <p>
          Kebijakan ini menjelaskan data apa yang disimpan {BRAND}, untuk apa, dan hakmu atas data itu, mengikuti Undang-Undang No. 27 Tahun 2022 tentang Pelindungan Data
          Pribadi. Halaman ini berlaku untuk pemilik usaha, karyawan, dan pembeli yang memesan lewat menu QR.
        </p>
      }
      sections={[
        ["data", "Data yang kami simpan", (
          <>
            <h3>Pemilik usaha dan karyawan</h3>
            <ul>
              <li>Nama, email atau nama login, dan peran. Kata sandi disimpan dalam bentuk acak (hash) yang tidak bisa dibaca, termasuk oleh kami.</li>
              <li>Data usaha: nama, alamat, telepon, logo, menu, foto, video, dan pengaturan.</li>
              <li>Catatan kerja: pesanan yang dibuat, pembayaran yang diterima, dan shift kasir.</li>
            </ul>
            <h3>Pembeli</h3>
            <ul>
              <li>Nama yang diisi saat memesan, isi pesanan, catatan, meja, dan waktu.</li>
              <li>Nomor HP, hanya kalau diberikan, untuk kartu stempel, antrean tunggu, atau struk WhatsApp.</li>
              <li>Penilaian dan komentar, kalau pembeli mengirimnya.</li>
              <li>
                Lokasi: kalau toko menyalakan pengaman lokasi, HP pembeli mengirim lokasinya satu kali saat mengirim pesanan. Yang disimpan hanya hasilnya (di dalam atau di luar
                toko) dan perkiraan jarak. Koordinat lokasi tidak disimpan.
              </li>
            </ul>
            <h3>Data teknis</h3>
            <ul>
              <li>Satu cookie sesi untuk menjaga pemilik dan karyawan tetap masuk. Pembeli tidak memerlukan akun atau cookie login.</li>
              <li>Penyimpanan di browser untuk pilihan bahasa, tema, salinan menu agar kasir tetap jalan saat offline, dan pesanan offline yang belum terkirim.</li>
              <li>Kami tidak memakai cookie iklan atau pelacak dari pihak ketiga.</li>
            </ul>
          </>
        )],
        ["pakai", "Untuk apa data dipakai", (
          <ul>
            <li>Menjalankan layanan: menampilkan menu, meneruskan pesanan ke kasir dan dapur, menghitung perkiraan siap, mencatat pembayaran dan stok.</li>
            <li>Fitur yang diminta pembeli: kartu stempel, antrean tunggu, struk digital, dan penilaian.</li>
            <li>Laporan penjualan untuk pemilik usaha.</li>
            <li>Keamanan: mencegah penyalahgunaan, pesanan palsu, dan akses tanpa izin.</li>
          </ul>
        )],
        ["peran", "Siapa yang mengendalikan data", (
          <p>
            Untuk data pemilik usaha dan karyawan, {LEGAL.operator} adalah pengendali data. Untuk data pembeli di sebuah toko, pemilik toko itu adalah pengendali data, dan {BRAND}
            memprosesnya atas nama toko.
          </p>
        )],
        ["bagi", "Dengan siapa data dibagikan", (
          <ul>
            <li>Kami tidak menjual data pribadi.</li>
            <li>Penyedia server dan penyimpanan berkas yang kami pakai untuk menjalankan layanan. Mereka hanya memproses data sesuai perintah kami.</li>
            <li>Struk WhatsApp dikirim dari aplikasi WhatsApp di perangkat kasir, bukan dari server kami. Tombol ulasan Google hanya tautan ke Google Maps.</li>
            <li>Pihak berwenang, kalau diwajibkan oleh hukum.</li>
          </ul>
        )],
        ["simpan", "Penyimpanan dan keamanan", (
          <ul>
            <li>Data dikirim lewat koneksi terenkripsi (HTTPS). Data setiap toko terpisah dan hanya bisa dibuka oleh akun toko itu.</li>
            <li>Data disimpan selama akun toko aktif. Setelah akun ditutup, data dihapus dalam waktu yang wajar, kecuali catatan transaksi yang wajib disimpan menurut hukum.</li>
            <li>Kalau terjadi kebocoran data, kami memberi tahu pihak yang terdampak sesuai ketentuan undang-undang.</li>
          </ul>
        )],
        ["hak", "Hakmu", (
          <>
            <p>Kamu berhak meminta salinan, perbaikan, atau penghapusan data pribadimu, menarik persetujuan, dan mengajukan keberatan.</p>
            <p>Pembeli bisa mengajukannya ke toko tempat memesan, atau langsung ke kami dan kami teruskan ke toko itu.</p>
          </>
        )],
        ["anak", "Anak-anak", <p>Akun toko hanya untuk orang dewasa yang cakap hukum. Pembeli di bawah umur sebaiknya memesan bersama orang tua atau wali.</p>],
        ["ubah", "Perubahan kebijakan", <p>Kalau kebijakan ini berubah, tanggal di bagian atas diperbarui. Perubahan penting kami umumkan di dasbor toko.</p>],
        ["kontak", "Kontak", <Contact />],
      ]}
    />
  );
}

/** Footer kecil: hak cipta + tautan hukum. Dipakai di landing, halaman masuk/daftar, dan halaman pembeli. */
export function LegalFoot({ compact = false, en = false }: { compact?: boolean; en?: boolean }) {
  return (
    <footer className={`legal-foot${compact ? " compact" : ""}`}>
      <span>© {copyrightYears()} {BRAND}. {en ? "All rights reserved." : "Hak cipta dilindungi undang-undang."}</span>
      <nav aria-label={en ? "Legal" : "Informasi hukum"}>
        <Link to="/syarat">{en ? "Terms" : "Syarat & Ketentuan"}</Link>
        <Link to="/privasi">{en ? "Privacy" : "Kebijakan Privasi"}</Link>
      </nav>
    </footer>
  );
}
