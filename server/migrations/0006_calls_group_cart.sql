-- Panggil pelayan / minta bill dari HP, dan keranjang bersama satu meja (pesan bareng).

CREATE TABLE service_calls (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_id TEXT NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
  table_label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('waiter', 'bill')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  geo_check TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  done_at INTEGER,
  done_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_calls_open ON service_calls(tenant_id, status, created_at);
CREATE INDEX idx_calls_table ON service_calls(table_id, created_at);

-- Satu baris = satu menu pilihan satu orang (satu HP) di satu meja. Dihapus saat pesanan meja dikirim.
CREATE TABLE table_cart_lines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_id TEXT NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
  device TEXT NOT NULL,
  person TEXT NOT NULL DEFAULT '',
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 50),
  note TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_cart_table ON table_cart_lines(table_id, updated_at);

-- Siapa yang memesan item ini dalam pesanan bareng, untuk bagi tagihan di kasir.
ALTER TABLE order_items ADD COLUMN person TEXT NOT NULL DEFAULT '';
