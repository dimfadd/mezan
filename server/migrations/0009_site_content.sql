-- Konten situs publik (menu atas, halaman solusi bisnis, testimoni, footer) yang diubah dari panel admin.
-- Satu baris per bagian, isinya JSON. Bagian yang belum ada memakai isi bawaan di shared/site.ts.
CREATE TABLE site_content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
