-- Perkiraan waktu siap untuk pembeli: kapan pesanan benar-benar siap (untuk belajar dari riwayat),
-- berapa pesanan yang bisa dimasak bersamaan, dan saklar untuk menyembunyikan perkiraan.
ALTER TABLE orders ADD COLUMN ready_at INTEGER;
ALTER TABLE tenants ADD COLUMN kitchen_lanes INTEGER NOT NULL DEFAULT 3;
ALTER TABLE tenants ADD COLUMN eta_enabled INTEGER NOT NULL DEFAULT 1;
