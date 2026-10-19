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

## Landing page dengan simulasi

Halaman depan (`web/src/pages/public/landing/`) memperagakan aplikasi lewat animasi, bukan klaim:

- **Simulasi satu pesanan** dari Meja 4: pindai QR, lihat galeri, tambah catatan, kirim, tiket masuk ke kasir, dibuat, dibayar, omzet bertambah. HP pembeli dan layar kasir bergerak bersamaan. Di HP hanya satu layar yang tampil bergantian.
- **Tab fitur** yang berpindah sendiri (kasir, stok, laporan, tampilan brand, dua bahasa, hak akses), masing-masing dengan peraga kecil. Tampilan brand memakai preset asli dari `shared/menuTheme.ts`, dua bahasa memakai kamus asli dari `shared/i18n.ts`.
- Animasi berhenti saat tidak terlihat atau tab browser disembunyikan, bisa dijeda, dan langsung diam (bisa diklik per langkah) kalau perangkat meminta gerak dikurangi.
- Dimuat terpisah dari menu QR, jadi pembeli yang memindai QR tidak ikut mengunduhnya.

## Siapa bisa apa

| Fitur | Pelanggan | Karyawan | Manajer | Pemilik | Admin Pesan.in |
|---|---|---|---|---|---|
| Lihat menu (foto/video), pesan dari meja, pantau status | ya | | | | |
| Papan pesanan, terima/tolak, tandai siap, terima bayar | | ya | ya | ya | |
| Kasir (catat pesanan walk-in), cetak struk | | ya | ya | ya | |
| Tandai menu habis/tersedia | | ya | ya | ya | |
| Lihat stok | | ya | ya | ya | |
| Ubah menu, harga, foto, video, kategori | | | ya | ya | |
| Atur tampilan menu (paket premium) | | | ya | ya | |
| Meja & QR, catat stok masuk/rusak | | | ya | ya | |
| Laporan penjualan & ekspor CSV | | | ya | ya | |
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
- **PWA**: tampilan aplikasi disimpan offline, data API tidak pernah di-cache supaya pesanan dan stok selalu terbaru.

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
9. **Logo & ikon final.** Ikon PWA saat ini placeholder huruf "m".
10. **Mode offline untuk kasir** (antre pesanan saat internet putus lalu kirim ulang).

## Deploy untuk testing (Vercel)

Lihat [docs/deploy-vercel.md](docs/deploy-vercel.md). Ringkasnya: import repo di Vercel, lalu (disarankan) tambahkan Turso untuk database permanen dan Vercel Blob untuk foto/video.

## Pindah ke Cloudflare

Lihat [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md).
