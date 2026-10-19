-- QR bawa pulang per toko, pengaman lokasi untuk pesanan QR, dan hasil cek lokasi per pesanan.

-- Kode QR bawa pulang: acak seperti kode meja, dibuat saat pertama dinyalakan.
ALTER TABLE tenants ADD COLUMN takeaway_code TEXT;
ALTER TABLE tenants ADD COLUMN takeaway_qr_enabled INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_takeaway_code ON tenants(takeaway_code);

-- Pengaman lokasi: off = tidak dicek, flag = pesanan tetap masuk tapi ditandai, block = pesanan dari luar radius ditolak.
ALTER TABLE tenants ADD COLUMN geo_mode TEXT NOT NULL DEFAULT 'off';
ALTER TABLE tenants ADD COLUMN geo_lat REAL;
ALTER TABLE tenants ADD COLUMN geo_lng REAL;
ALTER TABLE tenants ADD COLUMN geo_radius_m INTEGER NOT NULL DEFAULT 100;

-- Yang disimpan hanya hasil cek dan jaraknya, bukan koordinat pembeli.
-- '' = tidak dicek, ok = di dalam radius, far = di luar radius, unknown = lokasi tidak diizinkan / tidak akurat.
ALTER TABLE orders ADD COLUMN geo_check TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN geo_distance_m INTEGER;
