-- Galeri foto/video per menu dan info yang membentuk ekspektasi pembeli.

CREATE TABLE menu_media (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                 -- image | video
  url TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,    -- urutan 0 = sampul
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_menu_media_item ON menu_media(menu_item_id, sort);
CREATE INDEX idx_menu_media_tenant ON menu_media(tenant_id);

-- Pindahkan foto & video lama ke galeri.
INSERT INTO menu_media (id, tenant_id, menu_item_id, kind, url, sort, created_at)
  SELECT lower(hex(randomblob(16))), tenant_id, id, 'image', image_url, 0, created_at FROM menu_items WHERE image_url IS NOT NULL;
INSERT INTO menu_media (id, tenant_id, menu_item_id, kind, url, sort, created_at)
  SELECT lower(hex(randomblob(16))), tenant_id, id, 'video', video_url, 1, created_at FROM menu_items WHERE video_url IS NOT NULL;

-- Info detail (semua opsional).
ALTER TABLE menu_items ADD COLUMN portion TEXT NOT NULL DEFAULT '';       -- mis. "1 orang", "250 gram"
ALTER TABLE menu_items ADD COLUMN components TEXT NOT NULL DEFAULT '';    -- isi, satu per baris
ALTER TABLE menu_items ADD COLUMN spice_level INTEGER;                    -- NULL = tidak diisi, 0-5
ALTER TABLE menu_items ADD COLUMN prep_minutes INTEGER;                   -- perkiraan waktu saji
ALTER TABLE menu_items ADD COLUMN allergens TEXT NOT NULL DEFAULT '';     -- mis. "mengandung kacang"

-- Batas galeri per paket.
ALTER TABLE plans ADD COLUMN max_photos INTEGER NOT NULL DEFAULT 3;
ALTER TABLE plans ADD COLUMN max_videos INTEGER NOT NULL DEFAULT 0;
UPDATE plans SET max_videos = 1 WHERE allow_video = 1;
UPDATE plans SET max_photos = 6, max_videos = 2 WHERE allow_branding = 1;
