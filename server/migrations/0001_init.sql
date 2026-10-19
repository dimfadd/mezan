-- Mezan: skema awal.
-- Ditulis dalam SQLite standar supaya bisa dipakai apa adanya di Cloudflare D1.
-- Semua uang disimpan dalam rupiah bulat (INTEGER), semua waktu dalam epoch milidetik.

CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_monthly INTEGER NOT NULL DEFAULT 0,
  max_tables INTEGER NOT NULL DEFAULT 10,
  max_staff INTEGER NOT NULL DEFAULT 3,
  allow_video INTEGER NOT NULL DEFAULT 0,
  allow_inventory INTEGER NOT NULL DEFAULT 1,
  allow_analytics INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'resto',          -- resto | kafe | warung | toko
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'trial',        -- trial | active | past_due | suspended
  period_end INTEGER NOT NULL,                 -- akhir masa trial / langganan
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  tax_rate REAL NOT NULL DEFAULT 0,            -- persen, mis. 10 = 10%
  service_rate REAL NOT NULL DEFAULT 0,
  inventory_enabled INTEGER NOT NULL DEFAULT 0,
  qr_ordering_enabled INTEGER NOT NULL DEFAULT 1,
  tz_offset_minutes INTEGER NOT NULL DEFAULT 420, -- WIB
  welcome_note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE, -- NULL untuk admin platform
  name TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,                  -- email atau username, huruf kecil
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,                          -- platform_admin | owner | manager | staff
  active INTEGER NOT NULL DEFAULT 1,
  last_login_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_users_tenant ON users(tenant_id);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                         -- hash SHA-256 dari token cookie
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_categories_tenant ON categories(tenant_id, sort);

CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,
  image_url TEXT,
  video_url TEXT,
  tags TEXT NOT NULL DEFAULT '',               -- dipisah koma: pedas, favorit, vegetarian
  available INTEGER NOT NULL DEFAULT 1,
  track_stock INTEGER NOT NULL DEFAULT 0,
  stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  low_stock_at INTEGER NOT NULL DEFAULT 5,
  unit TEXT NOT NULL DEFAULT 'porsi',
  sort INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_items_tenant ON menu_items(tenant_id, archived, sort);

CREATE TABLE dining_tables (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,                   -- kode acak di QR, tidak bisa ditebak
  area TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_tables_tenant ON dining_tables(tenant_id);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,                     -- nomor antrean harian
  business_day TEXT NOT NULL,                  -- YYYY-MM-DD zona waktu toko
  table_id TEXT REFERENCES dining_tables(id) ON DELETE SET NULL,
  table_label TEXT,
  source TEXT NOT NULL,                        -- qr | pos
  order_type TEXT NOT NULL DEFAULT 'dine_in',  -- dine_in | takeaway
  customer_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',          -- new | preparing | ready | done | cancelled
  payment_status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid | paid
  payment_method TEXT,                         -- cash | qris | transfer | card
  amount_received INTEGER,
  subtotal INTEGER NOT NULL,
  tax INTEGER NOT NULL DEFAULT 0,
  service INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  cancel_reason TEXT,
  public_token TEXT NOT NULL UNIQUE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  paid_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  paid_at INTEGER
);
CREATE INDEX idx_orders_tenant_created ON orders(tenant_id, created_at);
CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, status);
CREATE UNIQUE INDEX idx_orders_daily_number ON orders(tenant_id, business_day, number);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id TEXT REFERENCES menu_items(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  change INTEGER NOT NULL,                     -- positif = masuk, negatif = keluar
  reason TEXT NOT NULL,                        -- restock | sale | cancel | adjust | waste
  note TEXT NOT NULL DEFAULT '',
  order_id TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_stock_tenant ON stock_movements(tenant_id, created_at);

CREATE TABLE subscription_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  amount INTEGER NOT NULL,
  months INTEGER NOT NULL DEFAULT 1,
  method TEXT NOT NULL DEFAULT 'transfer',
  note TEXT NOT NULL DEFAULT '',
  period_end_after INTEGER NOT NULL,
  recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_subpay_tenant ON subscription_payments(tenant_id, created_at);
