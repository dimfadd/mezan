# Pesan.in

Menu digital dengan foto dan video, pesan dari meja lewat QR, kasir (POS), stok opsional, dan laporan penjualan. Dibuat sebagai SaaS berlangganan bulanan untuk warung, kafe, resto, dan toko.

Status: **MVP tahap pengembangan lokal.** Belum dipakai di produksi. Lihat bagian "Belum dikerjakan" sebelum menjual ke pelanggan.

## Menjalankan di komputer sendiri

Butuh Node.js 22 atau lebih baru.

```bash
npm install
cp .env.example .env
npm run db:reset     # buat database lokal + isi data contoh
npm run dev          # API di :8787, web di http://localhost:5173
```

Akun data contoh (semua fiktif, toko contoh memakai paket Resto supaya editor tampilan bisa dicoba):

| Peran | Login | Kata sandi |
|---|---|---|
| Admin Pesan.in (developer) | `admin@mezan.local` | `admin12345` |
| Pemilik toko | `pemilik@contoh.id` | `contoh12345` |
| Manajer | `manajer@contoh.id` | `contoh12345` |
| Karyawan (kasir) | `kasir@contoh.id` | `contoh12345` |

Menu pelanggan Meja 1: http://localhost:5173/m/contoh-meja1

Untuk mencoba dari HP di jaringan Wi-Fi yang sama, buka `http://<IP-laptop>:5173`.

Perintah lain:

```bash
npm test             # tes alur bisnis (stok, pembatalan, hak akses, batas paket)
npm run typecheck
npm run build        # build web ke web/dist
npm start            # jalankan API + web hasil build dari satu server (port 8787)
node tests/smoke.mjs out/   # screenshot semua halaman di ukuran HP/tablet/PC + cek error console
```

## Detail menu untuk pembeli

Ide inti Pesan.in: pembeli bisa membayangkan pesanannya sebelum memesan. Saat menu diketuk, pembeli melihat:

- **Galeri foto & video** yang bisa digeser, dengan mode layar penuh. Video diputar otomatis tanpa suara hanya saat terlihat. Foto berikutnya baru dimuat saat mendekat supaya hemat kuota.
- **Porsi** (mis. "1 orang", "gelas 400 ml"), **perkiraan waktu saji**, **level pedas 0-5** (ikon cabai), **isi/komponen** sebagai daftar centang, dan **alergen**.

Jumlah foto & video per menu diatur per paket (Admin > Paket). Bawaan: Warung 3 foto, Kafe 5 foto + 1 video, Resto 6 foto + 2 video. Pemilik mengatur urutan dan sampul di halaman Menu & produk.

## Dua bahasa untuk pembeli (ID / EN)

Menu QR dan halaman status pesanan bisa dipindah Indonesia/Inggris lewat tombol ID | EN. Default mengikuti bahasa HP pembeli; pilihan tersimpan di HP.

- Pemilik mengisi versi Inggris (opsional) per menu: nama, deskripsi, porsi, isi, alergen. Juga nama kategori dan sapaan toko. Yang kosong otomatis memakai teks Indonesia. Filter "Belum ada versi Inggris" di halaman Menu membantu melacak yang belum diterjemahkan.
- Nama menu asli tetap jadi judul, nama Inggris jadi keterangan di bawahnya, supaya pelayan paham saat pembeli menyebut pesanannya.
- Catatan cepat ("Not spicy", "No onion") tampil sesuai bahasa pembeli tapi dikirim ke dapur dalam bahasa Indonesia ("Tidak pedas", "Tanpa bawang").
- Pesan galat untuk pembeli (menu habis, nama kosong, dll) ikut bahasanya. Layar kasir, dapur, dan admin tetap bahasa Indonesia.
- Teks antarmuka ada di `shared/i18n.ts`.

## Dua kelas pelanggan

| | UMKM (paket Warung, Kafe) | Bisnis besar (paket Resto) |
|---|---|---|
| Tampilan menu QR | Template Pesan.in | Bisa dipersonalisasi: 5 warna, font judul & isi (dikurasi), sudut kartu, tata letak daftar/galeri foto, logo, gambar latar |
| Titik awal | | 5 gaya jadi (Kertas warung, Kopi susu, Malam, Laut, Bata) |

Hak tampilan kustom diatur per paket lewat kolom `allow_branding` (Admin > Paket), jadi admin bisa memindahkan fitur ini ke paket mana pun tanpa ubah kode. Kalau toko turun paket, menu otomatis kembali ke template tanpa menghapus pengaturannya.

Pengaman: kombinasi warna yang kontrasnya di bawah WCAG AA (4,5:1) ditolak di editor dan di server, karena menu yang tidak terbaca merugikan toko itu sendiri. Kustomisasi hanya berlaku di halaman pelanggan; layar kasir tetap memakai tampilan Pesan.in supaya karyawan tidak bingung. Aturan tema ada di `shared/menuTheme.ts` dan dipakai bersama server + web.

## QR meja, QR bawa pulang, dan pengaman lokasi

- **Setiap meja punya kode QR acak sendiri** (10 karakter, bukan nomor urut), jadi tidak bisa ditebak dengan mengganti angka di alamat. Kode bisa diganti per meja kalau QR lama disalahgunakan.
- **QR bawa pulang**: satu QR per toko, dinyalakan dari Meja & QR. Pesanan masuk sebagai bawa pulang tanpa meja; status di HP pembeli berbunyi "Siap diambil". Maksimal 15 pesanan bawa pulang menunggu diterima per jam.
- **Pengaman lokasi** (Meja & QR): titik toko diambil dari perangkat kasir, radius bawaan 100 m.
  - *Tandai* (disarankan): pesanan tetap masuk, tiket kasir diberi peringatan merah kalau dikirim dari luar radius atau tanpa izin lokasi.
  - *Tolak*: pesanan dari luar radius atau tanpa izin lokasi ditolak.
  - Yang disimpan hanya hasil cek dan jaraknya, bukan koordinat pembeli. Koordinat toko tidak dikirim ke pembeli.
  - Batasan: GPS di dalam gedung bisa meleset puluhan meter dan lokasi bisa dipalsukan aplikasi fake GPS. Ini penghalang untuk iseng, bukan jaminan. Lapisan utama tetap: pesanan QR harus diterima kasir dulu sebelum dibuat.

## Panggil pelayan dan pesan bareng satu meja

- **Panggil pelayan / minta bill**: tombol "Panggil" di menu QR meja. Panggilan tampil di atas papan Pesanan kasir (ikut bunyi notifikasi), ditandai "Selesai" oleh karyawan, dan pembeli melihat kapan sudah ditanggapi. Panggilan yang sama tidak digandakan; maksimal 10 panggilan per meja per jam. Pengaman lokasi juga berlaku.
- **Pesan bareng**: semua HP yang memindai QR meja yang sama berbagi satu keranjang. Setiap orang memilih dari HP-nya sendiri, nama tampil per item, lalu siapa pun mengirim sekali untuk seluruh meja. HP lain langsung tahu pesanan sudah dikirim dan bisa membuka statusnya.
  - Di tiket kasir, setiap item diberi nama pemesannya, dan ada rincian **Bagi per orang** (sudah termasuk service dan pajak secara sebanding).
  - Keranjang disimpan di server (`table_cart_lines`) dan kedaluwarsa 3 jam. Maksimal 12 HP per meja dan 80 item sekali kirim.
  - HP pembeli memeriksa keadaan meja tiap 4 detik saat ada teman semeja atau keranjang dibuka, dan tiap 20 detik saat sendirian; berhenti saat tab disembunyikan.
- **QR berlogo**: QR meja dan bawa pulang memakai koreksi galat level H dengan ikon pesan.in di tengah. Sudah diuji terbaca decoder pada lebar 110-600 px.

## Tampilan daftar / kotak dan Best seller

- Pembeli bisa memilih tampilan daftar atau kotak (grid) di menu QR. Pilihannya disimpan di HP; kalau belum memilih, ikut tata letak pilihan toko.
- Label **Best seller** tampil sebagai stempel jempol di foto menu. Di editor menu, pemilik melihat jumlah terjual 30 hari terakhir dan urutannya, supaya label ini sesuai data.

## Kasir offline, shift, layar dapur

- **Kasir tetap jalan saat internet putus.** Daftar menu, meja, dan sesi login disimpan di perangkat; pesanan baru masuk "kotak keluar" (Offline 1, 2, ...) dan dikirim otomatis saat sinyal kembali, dengan waktu aslinya (harga promo, tanggal, dan shift ikut waktu itu). Tiap pesanan membawa ID dari perangkat, jadi kiriman ulang tidak dobel. Penjualan offline tidak ditolak karena stok/jadwal (barangnya sudah keluar); stok turun sampai nol, tidak minus. Pesanan QR dari pembeli tetap butuh internet. Lihat `web/src/lib/outbox.tsx`.
- **Kas & shift**: buka shift dengan modal awal, catat uang keluar/masuk laci, tutup dengan menghitung uang. Isi laci seharusnya = modal + penjualan tunai (dari waktu bayar) + masuk - keluar; selisih tersimpan saat tutup. Satu shift terbuka per toko. Riwayat hanya untuk pemilik/manajer. Kasir diingatkan (tidak dipaksa) kalau shift belum dibuka.
- **Layar dapur per bagian**: kategori diarahkan ke Dapur atau Bar (kategori bernama minuman/kopi/teh otomatis ke Bar). Tiket menampilkan waktu sejak diterima, berubah kuning saat lewat waktu saji menu dan merah di 1,5x. Item dicentang satu per satu; kalau semua bagian selesai, pesanan otomatis jadi "Siap diantar". Bisa layar penuh untuk tablet di dapur.

## Antrean dapur dan perkiraan siap untuk pembeli

Halaman pesanan pembeli (`/m/<kode>/pesanan/<token>` dan `/struk/<token>`) menampilkan antrean ke-berapa, jumlah pesanan di depan, dan perkiraan siap sebagai rentang menit plus jam. Hitungannya ada di `server/src/lib/eta.ts`:

- Lama masak satu pesanan = waktu saji terlama dari item yang belum selesai (item dimasak berbarengan). Menu tanpa waktu saji memakai median lama masak toko itu 30 hari terakhir (`orders.ready_at - accepted_at`, minimal 8 data), atau 10 menit.
- Dapur mengerjakan beberapa pesanan sekaligus (Pengaturan, "Pesanan yang bisa dimasak bersamaan", bawaan 3). Pesanan diurutkan seperti layar dapur: yang sudah diterima dulu, lalu yang menunggu kasir. Tiap pesanan menempati slot yang paling cepat kosong.
- Hasilnya rentang (85% sampai 120%), bukan janji. Kalau sudah lewat perkiraan, pembeli melihat "Sedikit lebih lama dari perkiraan", bukan angka nol atau minus. Pesanan aktif yang lebih tua dari 12 jam tidak ikut dihitung.
- Pemilik bisa mematikannya di Pengaturan. Akurasinya bergantung pada kasir yang menandai pesanan "Siap" tepat waktu: pesanan yang lupa ditutup membuat antrean terlihat lebih panjang.

## Pelanggan: stempel, ulasan, antrean

- **Kartu stempel lewat nomor HP**: kasir mengetik nomor saat menerima bayar (kartu langsung tampil, hadiah bisa ditukar di situ). Pembeli QR bisa mengambil stempel sendiri dari halaman pesanan setelah dibayar (sampai 24 jam). Satu pesanan = maksimal satu stempel (indeks unik), ada minimal belanja. Nomor HP tidak dikirim balik ke halaman publik.
- **Struk digital lewat WhatsApp**: setelah bayar, kasir menekan "Kirim" yang membuka WhatsApp di perangkat kasir dengan tautan `/struk/<token>`. Tidak memakai WhatsApp API berbayar.
- **Penilaian**: bintang 1-5, jempol per menu, catatan. Masuk laporan pemilik apa adanya. Tombol "Tulis ulasan di Google Maps" (tautan diisi di Pengaturan) ditampilkan ke **semua** pembeli setelah menilai, bukan hanya yang memberi bintang tinggi: Google melarang review gating dan bisa menghapus ulasan toko yang melakukannya.
- **Antrean tunggu**: QR di pintu (`/antre/<kode>`), tamu mengisi nama, jumlah orang, dan WA opsional, lalu melihat nomor dan posisinya. Saat kasir menekan Panggil, HP tamu berbunyi/bergetar (kalau halamannya terbuka) dan kasir bisa mengirim pesan WhatsApp. Tidak ada perkiraan waktu tunggu karena belum ada data yang cukup akurat.

## Menu per jam, happy hour, pasangan, modal

- **Jam tersedia per menu** (mis. bubur 06.00-10.00, menu akhir pekan). Di luar jam menu tetap terlihat dengan keterangan, tapi tidak bisa dipesan dari QR maupun kasir.
- **Promo jam tertentu**: diskon persen untuk kategori pilihan pada hari & jam tertentu, dibulatkan ke ratusan rupiah. Beberapa promo tidak ditumpuk; yang dipakai diskon terbesar. Harga dihitung di server memakai jam toko, dan di HP memakai selisih jam server (bukan jam HP). Harga normal tersimpan di item pesanan, potongannya muncul di laporan.
- **Saran pasangan**: maksimal 3 per menu, dipilih pemilik atau diambil dari menu yang sering dipesan bersama (60 hari, kategori berbeda). Tampil di detail menu, keranjang pembeli, dan layar kasir ("Tawarkan juga").
- **Modal (HPP) per porsi**: hanya terlihat pemilik/manajer. Modal disimpan per item saat terjual. Laporan menampilkan laba kotor dan mengelompokkan menu (menu engineering): Andalan, Laris tapi tipis, Untung tapi jarang, Perlu dievaluasi.
- **Mode video ala TikTok** di menu pembeli: satu menu satu layar, geser vertikal. Hanya video yang terlihat yang diputar, media dimuat untuk slide sekitar saja.

## Landing page dengan simulasi

Halaman depan (`web/src/pages/public/landing/`) memperagakan aplikasi lewat animasi, bukan klaim:

- **Simulasi satu pesanan** dari Meja 4: pindai QR, lihat galeri, tambah catatan, kirim, tiket masuk ke kasir, dibuat, dibayar, omzet bertambah. HP pembeli dan layar kasir bergerak bersamaan. Di HP hanya satu layar yang tampil bergantian.
- **Tab fitur dasar** yang berpindah sendiri (kasir, stok, laporan, tampilan brand, dua bahasa, hak akses), masing-masing dengan peraga kecil. Tampilan brand memakai preset asli dari `shared/menuTheme.ts`, dua bahasa memakai kamus asli dari `shared/i18n.ts`.
- Animasi berhenti saat tidak terlihat atau tab browser disembunyikan, bisa dijeda, dan langsung diam (bisa diklik per langkah) kalau perangkat meminta gerak dikurangi.
- Menu atas dengan dropdown Layanan & Solusi bisnis (menu geser di HP), bagian "Cara mulai" tiga langkah, "Pantau usaha dari HP", testimoni (kalau ada), dan footer berkolom; semuanya dari Konten situs di admin. Pembeli bisa memasang Pesan.in ke layar utama (PWA), bukan lewat Play Store/App Store.
- Toko baru melihat panduan "Mulai jualan dalam 3 langkah" di halaman Pesanan (isi menu, buat meja & cetak QR, coba pesan dari HP) yang tercentang sendiri.
- Urutan halaman disusun untuk meyakinkan pemilik: simulasi satu pesanan, lalu sorotan antrean & perkiraan siap ("Tidak ada lagi 'masih lama, Kak?'"), lalu "Yang membuat pembeli betah dan kembali" (mode video, panggil pelayan, pesan bareng, stempel, struk & rating, QR bawa pulang, antrean saat penuh, bagi tagihan), lalu "Untung lebih jelas, kebocoran lebih sedikit" (modal & untung, pasangan, jam & happy hour, best seller, layar dapur, kasir offline, shift, pengaman lokasi, QR berlogo), dan terakhir tab fitur dasar.
- Dimuat terpisah dari menu QR, jadi pembeli yang memindai QR tidak ikut mengunduhnya.

## Panel admin Pesan.in (`/admin`)

Untuk pengelola platform (peran `platform_admin`), bukan pemilik toko:

- **Ringkasan**: jumlah toko (masa coba, aktif, lewat masa tenggang, dinonaktifkan), pendapatan bulanan berulang, pendaftar 30 hari, langganan yang akan habis, pembayaran terakhir.
- **Toko**: cari dan buat toko, lihat detail, ubah paket/status/masa aktif, catat pembayaran langganan, reset sandi pengguna toko.
- **Paket**: harga, batas meja/karyawan/foto/video, dan fitur per paket.
- **Konten situs**: menu atas (tautan atau dropdown berkolom), halaman **solusi bisnis** (`/solusi/<alamat>`: judul, pembuka, masalah yang dibereskan, fitur yang ditampilkan, terbit/draf), **testimoni**, dan **footer** (kolom tautan, WhatsApp, email, jam layanan, alamat). Isi bawaan ada di `shared/site.ts`; tombol "Isi bawaan" mengembalikan satu bagian. Tautan divalidasi (hanya `/`, `#`, `https://`, `mailto:`).
- Testimoni hanya bisa terbit kalau admin mencentang punya izin tertulis dari orangnya (diperiksa juga di server), dan bagian testimoni di landing baru tampil setelah ada yang terbit. Jangan mengisi testimoni karangan.

**Keamanan:** data contoh membuat admin `admin@mezan.local` / `admin12345`. Di Vercel, isi variabel `ADMIN_PASSWORD` (minimal 12 karakter) supaya admin tidak memakai sandi contoh, dan `DEMO_SEED=0` untuk produksi. Tanpa Turso, database Vercel bersifat sementara: perubahan Konten situs hilang saat server mulai ulang.

## Hak cipta dan halaman hukum

- Footer "© Pesan.in. Hak cipta dilindungi undang-undang." dengan tautan **Syarat & Ketentuan** (`/syarat`) dan **Kebijakan Privasi** (`/privasi`) ada di landing, halaman masuk/daftar, Pengaturan toko, dan halaman pembeli (menu, status pesanan, antrean; versi Inggris untuk pembeli berbahasa Inggris). Pendaftaran toko menyebut persetujuan atas keduanya.
- Isi halaman ditulis mengikuti data yang benar-benar disimpan aplikasi (mis. koordinat lokasi pembeli tidak disimpan, tanpa pelacak pihak ketiga) dan merujuk UU Hak Cipta, UU Merek, dan UU PDP. Kalau fitur yang menyentuh data berubah, perbarui `web/src/pages/public/Legal.tsx` dan tanggal di `web/src/lib/legal.ts`.
- Identitas pengelola diisi lewat variabel lingkungan saat build: `VITE_LEGAL_OPERATOR` (nama orang/badan usaha), `VITE_LEGAL_EMAIL` (email resmi), `VITE_LEGAL_CITY` (kota domisili hukum). Tanpa itu, halaman memakai "Pengelola Pesan.in" dan belum menampilkan email.
- `LICENSE` menyatakan kode ini milik pribadi (bukan sumber terbuka); `package.json` memakai `"license": "UNLICENSED"`. Build produksi tidak menyertakan source map.
- Ini draf yang wajar untuk tahap uji, bukan nasihat hukum. Sebelum dipakai berbayar, minta ahli hukum meninjau dan daftarkan merek "Pesan.in" di DJKI.

## Siapa bisa apa

| Fitur | Pelanggan | Karyawan | Manajer | Pemilik | Admin Pesan.in |
|---|---|---|---|---|---|
| Lihat menu (foto/video, mode video), pesan dari meja (sendiri atau bareng), panggil pelayan, pantau status | ya | | | | |
| Beri penilaian, ambil stempel, daftar antrean tunggu | ya | | | | |
| Papan pesanan, terima/tolak, tandai siap, terima bayar, tanggapi panggilan meja | | ya | ya | ya | |
| Kasir (catat pesanan walk-in, juga saat offline), cetak struk, kirim struk WhatsApp | | ya | ya | ya | |
| Layar dapur, buka/tutup shift & catat kas laci, kelola antrean, tukar hadiah stempel | | ya | ya | ya | |
| Tandai menu habis/tersedia | | ya | ya | ya | |
| Lihat stok | | ya | ya | ya | |
| Ubah menu, harga, foto, video, kategori | | | ya | ya | |
| Atur tampilan menu (paket premium) | | | ya | ya | |
| Meja & QR, catat stok masuk/rusak | | | ya | ya | |
| Laporan penjualan, margin per menu, penilaian, ekspor CSV | | | ya | ya | |
| Riwayat shift & selisih laci, daftar pelanggan stempel, promo jam, modal (HPP) | | | ya | ya | |
| Kelola akun karyawan | | | karyawan saja | ya | |
| Kelola toko, paket, catat pembayaran langganan | | | | | ya |

Hak akses ditegakkan di server (`server/src/lib/auth.ts`), bukan hanya disembunyikan di tampilan.

## Struktur

```
server/
  migrations/      SQL skema (SQLite, langsung kompatibel dengan Cloudflare D1)
  src/app.ts       aplikasi Hono, sama untuk Node dan Cloudflare Workers
  src/node.ts      server lokal (better-sqlite3 + folder upload)
  src/worker.ts    entry Cloudflare (D1 + R2), belum diuji
  src/routes/      auth, public (pelanggan), store (toko), analytics, platform (admin)
  src/lib/orders.ts  logika pesanan: harga dari DB, pajak, stok, nomor antrean
  test/            tes node:test dengan DB di memori
web/
  src/pages/customer  menu QR + status pesanan
  src/pages/store     pesanan, kasir, menu, meja, stok, laporan, karyawan, pengaturan
  src/pages/admin     panel developer
  src/styles/app.css  sistem visual (token warna terang/gelap, komponen)
  public/sw.js        service worker PWA
```

## Keputusan teknis

- **Font khas: Fredoka.** Fredoka tidak punya angka tabular, jadi kolom angka di tabel dan rincian total memakai Plus Jakarta Sans supaya digit sejajar.
- **Hono + SQLite**: kode API yang sama jalan di Node (lokal), Vercel (Turso), dan Cloudflare Workers (D1). Lapisan DB (`server/src/db/types.ts`) meniru API D1, jadi pindah ke D1 tidak perlu menulis ulang query.
- **Harga dihitung di server.** Klien hanya mengirim ID menu dan jumlah. Harga yang dikirim klien diabaikan.
- **Uang dalam rupiah bulat (INTEGER)**, waktu dalam epoch milidetik, laporan memakai tanggal bisnis zona waktu toko (default WIB).
- **Pesanan masuk memakai polling tiap 5-7 detik**, bukan WebSocket. Lebih sederhana dan jalan di Workers tanpa Durable Objects. Cukup untuk warung/kafe; pertimbangkan Durable Objects kalau ada toko dengan ratusan pesanan per jam.
- **Video**: MP4/WebM maks 15 MB dan 20 detik, hanya di paket yang mengizinkan. GIF masih diterima (maks 3 MB) tapi tampilan menyarankan MP4 karena jauh lebih kecil. Foto diperkecil otomatis ke WebP 1200px di browser sebelum diunggah.
- **PWA**: tampilan aplikasi disimpan offline. Data API tidak di-cache oleh service worker; kasir menyimpan salinan menu/meja/sesi terakhir sendiri di perangkat supaya bisa dipakai saat internet putus.

## Belum dikerjakan

Ini yang perlu ada sebelum Pesan.in dijual ke toko sungguhan:

1. **Pembayaran langganan otomatis** (Midtrans/Xendit). Sekarang admin mencatat pembayaran manual dan masa aktif diperpanjang dari situ.
2. **Pembayaran QRIS dinamis untuk pelanggan.** Saat ini kasir menandai lunas secara manual setelah cek dana masuk.
3. **Varian & add-on menu** (ukuran, level pedas, topping berbayar). Sekarang diwakili lewat catatan per item.
4. **Stok bahan baku/resep** (1 porsi nasi goreng = 200 g beras). Sekarang stok per produk jadi.
5. **Lupa kata sandi lewat email** untuk pemilik. Sekarang reset dilakukan admin Pesan.in.
6. **Uji di Cloudflare** (`worker.ts`) dan pembatas percobaan login berbasis Cloudflare (yang sekarang hanya di memori server).
7. **Terjemahan otomatis** isi menu ke bahasa Inggris (butuh layanan penerjemah berbayar). Sekarang pemilik mengisi manual.
8. **Domain/subdomain sendiri untuk toko premium** (mis. menu.namaresto.com) dan font unggahan sendiri. Sekarang font dipilih dari daftar Google Fonts yang dikurasi.
9. **Logo final dari desainer.** Ikon "p" sekarang buatan sendiri (`web/public/icons/icon.svg`).
10. **Notifikasi push** untuk antrean tunggu (Web Push). Sekarang HP tamu berbunyi hanya kalau halamannya terbuka; kasir bisa mengabari lewat WhatsApp.
11. **Kasir offline lebih lanjut**: ubah status/bayar pesanan lama saat offline, dan cetak struk untuk pesanan yang belum tersinkron. Sekarang yang bisa offline: catat pesanan baru (bayar langsung atau nanti).

## Deploy untuk testing (Vercel)

Lihat [docs/deploy-vercel.md](docs/deploy-vercel.md). Ringkasnya: import repo di Vercel, lalu (disarankan) tambahkan Turso untuk database permanen dan Vercel Blob untuk foto/video.

## Pindah ke Cloudflare

Lihat [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md).
