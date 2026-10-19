# Deploy ke Vercel (untuk testing)

Build sudah disiapkan (`vercel.json` + `scripts/build-vercel.mjs`). Kamu cukup menyambungkan repo.

## 1. Sambungkan repo (sekali saja)

1. Buka https://vercel.com/new, pilih **Import Git Repository**, pilih `dimfadd/mezan`.
2. Framework Preset: biarkan **Other**. Build command dan install command sudah dibaca dari `vercel.json`, jangan diubah.
3. Klik **Deploy**. Setelah selesai, buka URL-nya dan masuk dengan akun contoh `pemilik@contoh.id` / `contoh12345`.

Tanpa langkah 2 di bawah, aplikasi jalan dalam **mode uji**: database sementara di server Vercel. Data bisa kembali ke awal kapan saja dan login bisa terputus, karena Vercel bisa menjalankan beberapa server sekaligus dengan database masing-masing. Ada peringatan kuning di layar selama mode ini aktif.

## 2. Database permanen: Turso (disarankan, gratis untuk skala uji)

1. Daftar di https://turso.tech, buat database (region terdekat: Singapore).
2. Ambil **Database URL** (`libsql://...`) dan buat **token**.
3. Di Vercel: Project > Settings > Environment Variables, tambahkan:
   - `TURSO_DATABASE_URL` = URL tadi
   - `TURSO_AUTH_TOKEN` = token tadi
4. Redeploy. Saat pertama dibuka, tabel dibuat otomatis dan data contoh diisi (kalau database masih kosong).

Turso memakai SQL yang sama dengan SQLite dan Cloudflare D1, jadi tidak ada kode yang perlu diubah saat nanti pindah ke Cloudflare.

## 3. Foto & video: Vercel Blob

1. Di Vercel: Project > Storage > Create > **Blob**, sambungkan ke project ini.
2. Vercel otomatis menambahkan `BLOB_READ_WRITE_TOKEN`. Redeploy.

Tanpa Blob, unggahan disimpan sementara dan bisa hilang.

Dengan Blob tersambung, foto dan video **diunggah langsung dari browser ke Blob** (video sampai 15 MB, 20 detik). Server hanya memberi izin setelah memeriksa login manajemen, folder toko, jenis file, dan batas paket, jadi isi file tidak lewat fungsi Vercel yang dibatasi ~4,5 MB.

Tanpa Blob, unggahan lewat server dibatasi 4 MB per file dan disimpan sementara.

## Variabel lain

| Nama | Isi | Keterangan |
|---|---|---|
| `DEMO_SEED` | `0` | Matikan pengisian data contoh (untuk toko sungguhan) |
| `MAX_UPLOAD_MB` | `4` | Batas unggah per file |

## Cara kerjanya

- `npm run build:vercel` menghasilkan `.vercel/output` (Build Output API): web statis + satu fungsi `api` hasil bundel esbuild.
- Semua `/api/*` dan `/media/*` masuk ke fungsi itu; alamat lain dibuka oleh aplikasi web (SPA).
- Database dipilih otomatis: Turso kalau `TURSO_DATABASE_URL` ada, kalau tidak SQLite sementara di `/tmp`.
- Media dilayani dengan redirect ke URL publik Blob, jadi file besar tidak lewat fungsi.
