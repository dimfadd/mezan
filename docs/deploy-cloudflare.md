# Pindah ke Cloudflare (D1 + R2 + Workers)

Belum pernah diuji. Langkah di bawah adalah rencana, cek ulang dengan dokumentasi Wrangler terbaru saat dijalankan.

1. Pasang Wrangler dan login: `npm i -D wrangler && npx wrangler login`
2. Buat database: `npx wrangler d1 create mezan`, salin `database_id` ke `wrangler.toml`.
3. Terapkan skema: `npx wrangler d1 migrations apply mezan --remote` (membaca `server/migrations`).
4. Buat bucket media: `npx wrangler r2 bucket create mezan-media`.
5. Buat akun admin pertama lewat `npx wrangler d1 execute mezan --remote --command "INSERT INTO users ..."` dengan hash dari `hashPassword()` di `server/src/lib/security.ts`, lalu isi paket dari panel admin.
6. Build web: `npm run build`, lalu `npx wrangler deploy`.

Hal yang perlu dicek setelah pindah:

- `db.batch()` di D1 berjalan sebagai satu transaksi, sama seperti adapter lokal. Pastikan tes `npm test` tetap menggambarkan perilaku D1.
- D1 membatasi 100 parameter per query. Query `IN (...)` di `loadOrderItems` dibatasi 100 pesanan, aman.
- PBKDF2 di Workers dibatasi 100.000 iterasi; nilai itu yang dipakai.
- Pembatas login di `routes/auth.ts` menyimpan data di memori, tidak berbagi antar isolate Worker. Ganti dengan binding Rate Limiting Cloudflare.
- Media dilayani lewat Worker (`/media/*`). Untuk hemat biaya, pertimbangkan domain publik R2 + cache Cloudflare.
