-- Varian produk (ukuran, warna, ukuran gelas), barcode/SKU, dan tagihan meja gabungan.

-- Nama pilihan varian per produk, mis. "Warna" dan "Ukuran". Kosong = tanpa varian.
ALTER TABLE menu_items ADD COLUMN opt1_name TEXT NOT NULL DEFAULT '';
ALTER TABLE menu_items ADD COLUMN opt2_name TEXT NOT NULL DEFAULT '';
-- Barcode & SKU untuk produk tanpa varian (produk bervarian memakai barcode per varian).
ALTER TABLE menu_items ADD COLUMN barcode TEXT NOT NULL DEFAULT '';
ALTER TABLE menu_items ADD COLUMN sku TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_items_barcode ON menu_items(tenant_id, barcode) WHERE barcode != '';

-- Untuk produk bervarian, menu_items.stock_qty = jumlah stok semua varian aktif (diperbarui bersamaan).
CREATE TABLE item_variants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  opt1 TEXT NOT NULL DEFAULT '',
  opt2 TEXT NOT NULL DEFAULT '',
  price INTEGER,                               -- kosong = harga produk
  cost INTEGER,                                -- kosong = modal produk
  sku TEXT NOT NULL DEFAULT '',
  barcode TEXT NOT NULL DEFAULT '',
  stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  available INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_variants_item ON item_variants(item_id, archived, sort);
CREATE INDEX idx_variants_barcode ON item_variants(tenant_id, barcode) WHERE barcode != '';

ALTER TABLE order_items ADD COLUMN variant_id TEXT;
ALTER TABLE order_items ADD COLUMN variant_name TEXT NOT NULL DEFAULT '';
ALTER TABLE stock_movements ADD COLUMN variant_id TEXT;
ALTER TABLE table_cart_lines ADD COLUMN variant_id TEXT;

-- Pesanan yang dibayar sekaligus dalam satu tagihan meja: sama-sama memakai bill_id.
ALTER TABLE orders ADD COLUMN bill_id TEXT;
CREATE INDEX idx_orders_unpaid ON orders(tenant_id, payment_status, status);

-- Penjaga bayar-sekaligus: baris ini hanya bisa ditulis kalau semua pesanan di tagihan benar-benar
-- berubah jadi lunas di transaksi yang sama. Kalau ada yang sudah dibayar di perangkat lain, CHECK gagal
-- dan seluruh transaksi dibatalkan (berlaku sama di SQLite, Turso, maupun D1).
CREATE TABLE bill_guard (
  id TEXT PRIMARY KEY,
  diff INTEGER NOT NULL CHECK (diff = 0)
);
