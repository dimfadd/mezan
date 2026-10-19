-- Kasir offline, shift & laci, layar dapur per bagian, ulasan pembeli, menu per jam & happy hour,
-- kartu stempel, antrean tunggu, saran pasangan menu, dan modal (HPP) per menu.

-- ---------- Kasir offline ----------
-- Pesanan yang dibuat saat internet putus membawa ID dari perangkat, supaya kiriman ulang tidak dobel.
ALTER TABLE orders ADD COLUMN client_id TEXT;
ALTER TABLE orders ADD COLUMN offline INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX idx_orders_client ON orders(tenant_id, client_id) WHERE client_id IS NOT NULL;

-- ---------- Shift kasir & rekap laci ----------
-- Satu laci per toko: hanya boleh ada satu shift terbuka.
CREATE TABLE cash_shifts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  opened_at INTEGER NOT NULL,
  opening_cash INTEGER NOT NULL DEFAULT 0,
  closed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  closed_at INTEGER,
  expected_cash INTEGER,
  counted_cash INTEGER,
  note TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX idx_shift_open ON cash_shifts(tenant_id) WHERE status = 'open';
CREATE INDEX idx_shift_tenant ON cash_shifts(tenant_id, opened_at);

-- Uang masuk/keluar laci di luar penjualan (beli es batu, setor ke pemilik, tambah uang kembalian).
CREATE TABLE cash_moves (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shift_id TEXT NOT NULL REFERENCES cash_shifts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('in', 'out')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  note TEXT NOT NULL DEFAULT '',
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_cash_moves_shift ON cash_moves(shift_id);

-- ---------- Layar dapur per bagian ----------
ALTER TABLE categories ADD COLUMN station TEXT NOT NULL DEFAULT 'kitchen'; -- kitchen | bar
UPDATE categories SET station = 'bar'
  WHERE lower(name) LIKE '%minum%' OR lower(name) LIKE '%kopi%' OR lower(name) LIKE '%drink%' OR lower(name) LIKE '%jus%' OR lower(name) LIKE '%teh%';
ALTER TABLE order_items ADD COLUMN station TEXT NOT NULL DEFAULT 'kitchen';
ALTER TABLE order_items ADD COLUMN ready_at INTEGER;
-- Kapan pesanan mulai dibuat; pengatur waktu di layar dapur dihitung dari sini.
ALTER TABLE orders ADD COLUMN accepted_at INTEGER;
UPDATE orders SET accepted_at = created_at WHERE status != 'new';

-- ---------- Ulasan pembeli ----------
ALTER TABLE tenants ADD COLUMN google_review_url TEXT NOT NULL DEFAULT '';
CREATE TABLE order_feedback (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_feedback_tenant ON order_feedback(tenant_id, created_at);
CREATE TABLE item_feedback (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  liked INTEGER NOT NULL CHECK (liked IN (0, 1)),
  created_at INTEGER NOT NULL,
  UNIQUE (order_id, menu_item_id)
);
CREATE INDEX idx_item_feedback_tenant ON item_feedback(tenant_id, created_at);

-- ---------- Menu per jam & happy hour ----------
-- Hari: bit 0 = Minggu ... bit 6 = Sabtu (127 = setiap hari). Jam dalam menit sejak 00:00 waktu toko; NULL = sepanjang hari.
ALTER TABLE menu_items ADD COLUMN avail_days INTEGER NOT NULL DEFAULT 127;
ALTER TABLE menu_items ADD COLUMN avail_from INTEGER;
ALTER TABLE menu_items ADD COLUMN avail_to INTEGER;
CREATE TABLE price_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  percent INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 90),
  days INTEGER NOT NULL DEFAULT 127,
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL,
  category_ids TEXT NOT NULL DEFAULT '',   -- kosong = semua menu
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_price_rules_tenant ON price_rules(tenant_id);
-- Harga normal saat dipesan, kalau harga yang dibayar adalah harga promo.
ALTER TABLE order_items ADD COLUMN list_price INTEGER;

-- ---------- Kartu stempel ----------
ALTER TABLE tenants ADD COLUMN loyalty_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN loyalty_target INTEGER NOT NULL DEFAULT 10;
ALTER TABLE tenants ADD COLUMN loyalty_min_spend INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN loyalty_reward TEXT NOT NULL DEFAULT '';
CREATE TABLE loyalty_members (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,                       -- format 62xxxxxxxx
  name TEXT NOT NULL DEFAULT '',
  stamps INTEGER NOT NULL DEFAULT 0 CHECK (stamps >= 0),
  total_stamps INTEGER NOT NULL DEFAULT 0,
  rewards INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_visit_at INTEGER,
  UNIQUE (tenant_id, phone)
);
CREATE TABLE loyalty_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('stamp', 'redeem')),
  delta INTEGER NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
-- Satu pesanan hanya bisa memberi satu stempel.
CREATE UNIQUE INDEX idx_loyalty_stamp_once ON loyalty_events(order_id) WHERE kind = 'stamp';
CREATE INDEX idx_loyalty_events_member ON loyalty_events(member_id, created_at);
ALTER TABLE orders ADD COLUMN member_id TEXT REFERENCES loyalty_members(id) ON DELETE SET NULL;

-- ---------- Antrean tunggu ----------
ALTER TABLE tenants ADD COLUMN waitlist_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN waitlist_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_waitlist_code ON tenants(waitlist_code);
CREATE TABLE waitlist (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  business_day TEXT NOT NULL,
  name TEXT NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size BETWEEN 1 AND 50),
  phone TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'qr',           -- qr | kasir
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'seated', 'cancelled', 'noshow')),
  token TEXT NOT NULL UNIQUE,
  table_label TEXT,
  created_at INTEGER NOT NULL,
  called_at INTEGER,
  done_at INTEGER
);
CREATE UNIQUE INDEX idx_waitlist_number ON waitlist(tenant_id, business_day, number);
CREATE INDEX idx_waitlist_open ON waitlist(tenant_id, status, created_at);

-- ---------- Saran pasangan & modal per menu ----------
ALTER TABLE menu_items ADD COLUMN pair_ids TEXT NOT NULL DEFAULT '';  -- dipilih pemilik, dipisah koma
ALTER TABLE menu_items ADD COLUMN cost INTEGER;                       -- modal (HPP) per satuan, NULL = belum diisi
ALTER TABLE order_items ADD COLUMN unit_cost INTEGER;                 -- modal saat terjual, untuk laporan margin
