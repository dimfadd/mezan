-- Tampilan menu yang bisa dipersonalisasi (paket premium).
ALTER TABLE plans ADD COLUMN allow_branding INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN menu_theme TEXT NOT NULL DEFAULT '{}';
