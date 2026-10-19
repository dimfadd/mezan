// Tes alur bisnis utama memakai database SQLite di memori.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createApp } from "../src/app";
import { openNodeDb } from "../src/db/node";
import { migrate } from "../src/db/migrate";
import type { MediaStorage } from "../src/lib/storage";
import { hashPassword, newId } from "../src/lib/security";

const mem = new Map<string, ArrayBuffer>();
const storage: MediaStorage = {
  async put(k, d) { mem.set(k, d); },
  async get(k) { const b = mem.get(k); return b ? { body: new Uint8Array(b), contentType: "image/png", size: b.byteLength } : null; },
  async delete(k) { mem.delete(k); },
};

async function setup(blobToken?: string) {
  const db = openNodeDb(":memory:");
  migrate(db.raw, resolve("server/migrations"), false);
  const app = createApp({ db, storage, blobToken });
  const now = Date.now();
  const planId = newId();
  db.raw.prepare("INSERT INTO plans (id, code, name, price_monthly, max_tables, max_staff, allow_video, created_at) VALUES (?, 'basic', 'Dasar', 50000, 2, 1, 0, ?)").run(planId, now);
  const tenantId = newId();
  db.raw.prepare("INSERT INTO tenants (id, slug, name, plan_id, status, period_end, inventory_enabled, tax_rate, service_rate, created_at) VALUES (?, 't', 'Toko Uji', ?, 'active', ?, 1, 10, 5, ?)").run(tenantId, planId, now + 86400000 * 10, now);
  const pw = await hashPassword("rahasia123");
  db.raw.prepare("INSERT INTO users (id, tenant_id, name, login, password_hash, role, created_at) VALUES (?, ?, 'Owner', 'owner@t', ?, 'owner', ?)").run(newId(), tenantId, pw, now);
  db.raw.prepare("INSERT INTO users (id, tenant_id, name, login, password_hash, role, created_at) VALUES (?, ?, 'Kasir', 'kasir@t', ?, 'staff', ?)").run(newId(), tenantId, pw, now);

  const call = async (method: string, path: string, body?: unknown, cookie?: string) => {
    const res = await app.request(path, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null, cookie: res.headers.get("set-cookie")?.split(";")[0] };
  };
  const login = async (l: string) => (await call("POST", "/api/auth/login", { login: l, password: "rahasia123" })).cookie!;
  return { db, call, login, tenantId };
}

test("alur pesanan QR: harga dari server, pajak, stok, batal mengembalikan stok", async () => {
  const { call, login, db } = await setup();
  const owner = await login("owner@t");
  const item = await call("POST", "/api/store/items", { category_id: null, name: "Air", price: 10000, track_stock: 1 }, owner);
  assert.equal(item.status, 201);
  await call("POST", "/api/store/stock/movements", { itemId: item.json.id, mode: "restock", qty: 3 }, owner);
  await call("POST", "/api/store/tables", { label: "Meja 1" }, owner);
  const code = (db.raw.prepare("SELECT code FROM dining_tables").get() as { code: string }).code;

  // Klien tidak bisa mengirim harga sendiri; stok tidak cukup ditolak.
  const tooMany = await call("POST", "/api/public/orders", { tableCode: code, customerName: "A", items: [{ id: item.json.id, qty: 4 }] });
  assert.equal(tooMany.status, 409);

  const ok = await call("POST", "/api/public/orders", { tableCode: code, customerName: "A", items: [{ id: item.json.id, qty: 2, price: 1 }] });
  assert.equal(ok.status, 201);
  const o = db.raw.prepare("SELECT * FROM orders").get() as { id: string; subtotal: number; service: number; tax: number; total: number; status: string };
  assert.equal(o.subtotal, 20000);
  assert.equal(o.service, 1000);
  assert.equal(o.tax, 2100);
  assert.equal(o.total, 23100);
  assert.equal(o.status, "new");
  assert.equal((db.raw.prepare("SELECT stock_qty FROM menu_items").get() as { stock_qty: number }).stock_qty, 1);

  const kasir = await login("kasir@t");
  assert.equal((await call("PATCH", `/api/store/orders/${o.id}/status`, { status: "done" }, kasir)).status, 409, "lompat status ditolak");
  assert.equal((await call("PATCH", `/api/store/orders/${o.id}/status`, { status: "cancelled", reason: "tes" }, kasir)).status, 200);
  assert.equal((db.raw.prepare("SELECT stock_qty FROM menu_items").get() as { stock_qty: number }).stock_qty, 3, "stok kembali");

  const status = await call("GET", `/api/public/orders/${ok.json.token}`);
  assert.equal(status.json.order.status, "cancelled");
  assert.equal(status.json.order.id, undefined, "ID internal tidak bocor ke pelanggan");
});

test("kasir: bayar tunai, uang kurang ditolak", async () => {
  const { call, login } = await setup();
  const owner = await login("owner@t");
  const item = await call("POST", "/api/store/items", { category_id: null, name: "Nasi", price: 15000 }, owner);
  const kasir = await login("kasir@t");
  const short = await call("POST", "/api/store/orders", { orderType: "takeaway", items: [{ id: item.json.id, qty: 1 }], payment: { method: "cash", amountReceived: 1000 } }, kasir);
  assert.equal(short.status, 400);
  const paid = await call("POST", "/api/store/orders", { orderType: "takeaway", items: [{ id: item.json.id, qty: 1 }], payment: { method: "cash", amountReceived: 20000 } }, kasir);
  assert.equal(paid.status, 201);
  assert.equal(paid.json.number, 1);
  const second = await call("POST", "/api/store/orders", { orderType: "takeaway", items: [{ id: item.json.id, qty: 1 }], payment: null }, kasir);
  assert.equal(second.json.number, 2, "nomor antrean harian berurutan");
});

test("hak akses: karyawan tidak bisa buka laporan, ubah harga, atau panel admin", async () => {
  const { call, login } = await setup();
  const kasir = await login("kasir@t");
  assert.equal((await call("GET", "/api/store/analytics", undefined, kasir)).status, 403);
  assert.equal((await call("POST", "/api/store/items", { name: "X", price: 1, category_id: null }, kasir)).status, 403);
  assert.equal((await call("GET", "/api/store/staff", undefined, kasir)).status, 403);
  assert.equal((await call("GET", "/api/platform/overview", undefined, kasir)).status, 403);
  assert.equal((await call("GET", "/api/store/orders")).status, 401);
  const owner = await login("owner@t");
  assert.equal((await call("GET", "/api/store/analytics?range=7", undefined, owner)).status, 200);
});

test("batas paket: meja, karyawan, dan video", async () => {
  const { call, login } = await setup();
  const owner = await login("owner@t");
  assert.equal((await call("POST", "/api/store/tables", { prefix: "Meja", from: 1, to: 3 }, owner)).status, 403);
  assert.equal((await call("POST", "/api/store/tables", { prefix: "Meja", from: 1, to: 2 }, owner)).status, 201);
  assert.equal((await call("POST", "/api/store/staff", { name: "Budi", login: "budi@t", role: "staff", password: "123456" }, owner)).status, 403, "max_staff 1 sudah terpakai kasir");
});

test("toko yang langganannya habis lewat masa tenggang tidak menerima pesanan", async () => {
  const { call, login, db, tenantId } = await setup();
  const owner = await login("owner@t");
  const item = await call("POST", "/api/store/items", { category_id: null, name: "Teh", price: 5000 }, owner);
  await call("POST", "/api/store/tables", { label: "M" }, owner);
  const code = (db.raw.prepare("SELECT code FROM dining_tables").get() as { code: string }).code;
  db.raw.prepare("UPDATE tenants SET period_end = ? WHERE id = ?").run(Date.now() - 5 * 86400000, tenantId);
  const r = await call("POST", "/api/public/orders", { tableCode: code, customerName: "A", items: [{ id: item.json.id, qty: 1 }] });
  assert.equal(r.status, 403);
  const pos = await call("POST", "/api/store/orders", { orderType: "takeaway", items: [{ id: item.json.id, qty: 1 }] }, owner);
  assert.equal(pos.status, 403);
});

test("isolasi antar toko: tidak bisa mengubah menu toko lain", async () => {
  const { call, login, db } = await setup();
  const owner = await login("owner@t");
  const otherTenant = newId();
  const plan = (db.raw.prepare("SELECT id FROM plans").get() as { id: string }).id;
  db.raw.prepare("INSERT INTO tenants (id, slug, name, plan_id, period_end, created_at) VALUES (?, 'lain', 'Lain', ?, ?, ?)").run(otherTenant, plan, Date.now() + 1e9, Date.now());
  const foreign = newId();
  db.raw.prepare("INSERT INTO menu_items (id, tenant_id, name, price, created_at) VALUES (?, ?, 'Rahasia', 1, ?)").run(foreign, otherTenant, Date.now());
  assert.equal((await call("PATCH", `/api/store/items/${foreign}/availability`, { available: false }, owner)).status, 404);
  assert.equal((await call("PUT", `/api/store/items/${foreign}`, { category_id: null, name: "x", price: 1 }, owner)).status, 404);
  const foreignUrl = `/media/${otherTenant}/${newId()}.png`;
  const mine = await call("POST", "/api/store/items", { category_id: null, name: "Pasang media asing", price: 1, media: [{ kind: "image", url: foreignUrl }] }, owner);
  assert.equal(mine.status, 400);
});

test("batal dobel tidak mengembalikan stok dua kali; stok tidak bisa minus", async () => {
  const { call, login, db } = await setup();
  const owner = await login("owner@t");
  const item = await call("POST", "/api/store/items", { category_id: null, name: "Kerupuk", price: 2000, track_stock: 1 }, owner);
  await call("POST", "/api/store/stock/movements", { itemId: item.json.id, mode: "restock", qty: 5 }, owner);
  const o = await call("POST", "/api/store/orders", { orderType: "takeaway", items: [{ id: item.json.id, qty: 2 }] }, owner);
  const { restockCancelledOrder } = await import("../src/lib/orders");
  const tenantId = (db.raw.prepare("SELECT tenant_id FROM menu_items").get() as { tenant_id: string }).tenant_id;
  // Simulasikan dua permintaan batal yang membaca status bersamaan.
  const a = await restockCancelledOrder(db, tenantId, o.json.id, null);
  const b = await restockCancelledOrder(db, tenantId, o.json.id, null);
  await db.batch(a);
  await db.batch(b);
  assert.equal((db.raw.prepare("SELECT stock_qty FROM menu_items").get() as { stock_qty: number }).stock_qty, 5);
  assert.throws(() => db.raw.prepare("UPDATE menu_items SET stock_qty = -1").run(), /CHECK/);
});

test("CSRF: form lintas situs dan body non-JSON ditolak", async () => {
  const { db } = await setup();
  const app = createApp({ db, storage });
  const r1 = await app.request("/api/auth/login", { method: "POST", headers: { "content-type": "text/plain" }, body: '{"login":"owner@t","password":"rahasia123"}' });
  assert.equal(r1.status, 415);
  const r2 = await app.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "sec-fetch-site": "cross-site" }, body: "{}" });
  assert.equal(r2.status, 403);
});

test("tampilan menu: template untuk paket biasa, kustom untuk premium, kontras buruk ditolak", async () => {
  const { checkTheme, normalizeTheme, PRESETS, DEFAULT_THEME } = await import("../../shared/menuTheme");
  for (const p of PRESETS) assert.deepEqual(checkTheme(normalizeTheme({ ...DEFAULT_THEME, ...p.theme })), [], `preset ${p.id} harus terbaca`);

  const { call, login, db } = await setup();
  const owner = await login("owner@t");
  await call("POST", "/api/store/tables", { label: "M" }, owner);
  const code = (db.raw.prepare("SELECT code FROM dining_tables").get() as { code: string }).code;
  const custom = { ...DEFAULT_THEME, brand: "#6b3e26", headingFont: "playfair" };
  assert.equal((await call("PUT", "/api/store/theme", custom, owner)).status, 403, "paket tanpa branding");

  db.raw.prepare("UPDATE plans SET allow_branding = 1").run();
  const bad = await call("PUT", "/api/store/theme", { ...custom, ink: "#dddddd" }, owner);
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /kontras/);
  assert.equal((await call("PUT", "/api/store/theme", custom, owner)).status, 200);
  assert.equal((await call("GET", `/api/public/table/${code}`)).json.store.theme.headingFont, "playfair");

  // Turun paket: menu otomatis kembali ke template tanpa menghapus pengaturan.
  db.raw.prepare("UPDATE plans SET allow_branding = 0").run();
  assert.equal((await call("GET", `/api/public/table/${code}`)).json.store.theme.headingFont, "fredoka");
});

test("migrations.gen.ts sinkron dengan server/migrations/*.sql", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { MIGRATIONS } = await import("../src/db/migrations.gen");
  const files = readdirSync("server/migrations").filter((f) => f.endsWith(".sql")).sort();
  assert.deepEqual(MIGRATIONS.map((m) => m.name), files, "jalankan npm run gen");
  for (const m of MIGRATIONS) assert.equal(m.sql, readFileSync(`server/migrations/${m.name}`, "utf8"), `${m.name} berubah, jalankan npm run gen`);
});

test("galeri: batas foto/video per paket, sampul otomatis, detail sampai ke pembeli", async () => {
  const { call, login, db, tenantId } = await setup();
  const owner = await login("owner@t");
  const img = () => ({ kind: "image" as const, url: `/media/${tenantId}/${newId()}.webp` });
  const vid = () => ({ kind: "video" as const, url: `/media/${tenantId}/${newId()}.mp4` });
  // Paket uji: default migrasi 3 foto, tanpa video.
  assert.equal((await call("POST", "/api/store/items", { category_id: null, name: "A", price: 1, media: [img(), img(), img(), img()] }, owner)).status, 403);
  assert.equal((await call("POST", "/api/store/items", { category_id: null, name: "A", price: 1, media: [vid()] }, owner)).status, 403);
  const a = img(), b = img();
  const item = await call("POST", "/api/store/items", {
    category_id: null, name: "Soto", price: 17000, media: [a, b],
    portion: "1 mangkuk", components: "Kuah kuning\nSuwiran ayam", spice_level: 0, prep_minutes: 7, allergens: "Mengandung telur",
  }, owner);
  assert.equal(item.status, 201);
  const row = db.raw.prepare("SELECT image_url FROM menu_items WHERE id = ?").get(item.json.id) as { image_url: string };
  assert.equal(row.image_url, a.url, "foto pertama jadi sampul");

  // Ubah urutan: b jadi sampul. Paket dinaikkan supaya boleh video.
  db.raw.prepare("UPDATE plans SET allow_video = 1, max_videos = 2, max_photos = 6").run();
  const v = vid();
  assert.equal((await call("PUT", `/api/store/items/${item.json.id}`, { category_id: null, name: "Soto", price: 17000, media: [v, b, a] }, owner)).status, 200);
  const row2 = db.raw.prepare("SELECT image_url, video_url FROM menu_items WHERE id = ?").get(item.json.id) as { image_url: string; video_url: string };
  assert.equal(row2.image_url, b.url);
  assert.equal(row2.video_url, v.url);

  await call("POST", "/api/store/tables", { label: "M" }, owner);
  const code = (db.raw.prepare("SELECT code FROM dining_tables").get() as { code: string }).code;
  const pub = (await call("GET", `/api/public/table/${code}`)).json.items[0];
  assert.deepEqual(pub.media.map((m: { url: string }) => m.url), [v.url, b.url, a.url]);
  assert.equal(pub.portion, "", "PUT tanpa field detail mengosongkannya");

  // Duplikat file ditolak.
  assert.equal((await call("PUT", `/api/store/items/${item.json.id}`, { category_id: null, name: "Soto", price: 1, media: [a, a] }, owner)).status, 400);
});

test("detail menu tersimpan dan tampil di menu pelanggan", async () => {
  const { call, login, db } = await setup();
  const owner = await login("owner@t");
  await call("POST", "/api/store/items", { category_id: null, name: "Geprek", price: 18000, portion: "1 orang", components: "Nasi\nAyam", spice_level: 4, prep_minutes: 12, allergens: "Gluten" }, owner);
  await call("POST", "/api/store/tables", { label: "M" }, owner);
  const code = (db.raw.prepare("SELECT code FROM dining_tables").get() as { code: string }).code;
  const it = (await call("GET", `/api/public/table/${code}`)).json.items[0];
  assert.equal(it.spice_level, 4);
  assert.equal(it.prep_minutes, 12);
  assert.equal(it.components, "Nasi\nAyam");
  assert.equal(it.allergens, "Gluten");
});

test("unggah langsung ke Blob: izin hanya untuk manajemen, folder toko sendiri, dan jenis file sesuai paket", async () => {
  const { call, login, tenantId } = await setup("vercel_blob_rw_teststore_secretsecretsecret");
  const ev = (pathname: string) => ({ type: "blob.generate-client-token", payload: { pathname, callbackUrl: "http://x", clientPayload: null, multipart: false } });
  const owner = await login("owner@t");
  const ok = await call("POST", "/api/media-upload", ev(`media/${tenantId}/${newId()}.webp`), owner);
  assert.equal(ok.status, 200);
  assert.equal(ok.json.type, "blob.generate-client-token");
  assert.ok(ok.json.clientToken);
  assert.equal((await call("POST", "/api/media-upload", ev(`media/toko-lain/${newId()}.webp`), owner)).status, 400, "folder toko lain");
  assert.equal((await call("POST", "/api/media-upload", ev(`media/${tenantId}/${newId()}.mp4`), owner)).status, 400, "paket tanpa video");
  const kasir = await login("kasir@t");
  assert.equal((await call("POST", "/api/media-upload", ev(`media/${tenantId}/${newId()}.webp`), kasir)).status, 403);
  assert.equal((await call("POST", "/api/media-upload", ev(`media/${tenantId}/${newId()}.webp`))).status, 401);
});

test("bahasa: isi Inggris tersimpan, galat untuk pembeli ikut bahasanya, kasir tetap Indonesia", async () => {
  const { call, login, db } = await setup();
  const owner = await login("owner@t");
  const cat = await call("POST", "/api/store/categories", { name: "Minuman", name_en: "Drinks" }, owner);
  const item = await call("POST", "/api/store/items", { category_id: cat.json.id, name: "Es Teh", price: 5000, name_en: "Iced tea", description_en: "Sweet", available: 0 }, owner);
  await call("POST", "/api/store/tables", { label: "M" }, owner);
  const code = (db.raw.prepare("SELECT code FROM dining_tables").get() as { code: string }).code;
  const menu = (await call("GET", `/api/public/table/${code}?lang=en`)).json;
  assert.equal(menu.categories[0].name_en, "Drinks");
  assert.equal(menu.items[0].name_en, "Iced tea");

  const en = await call("POST", "/api/public/orders", { tableCode: code, customerName: "Sam", lang: "en", items: [{ id: item.json.id, qty: 1 }] });
  assert.equal(en.json.error, "Iced tea is sold out.");
  const enName = await call("POST", "/api/public/orders", { tableCode: code, customerName: "", lang: "en", items: [{ id: item.json.id, qty: 1 }] });
  assert.match(enName.json.error, /Add your name/);
  assert.match((await call("GET", "/api/public/table/zzzzzzzz?lang=en")).json.error, /table code/);
  const idMsg = await call("POST", "/api/public/orders", { tableCode: code, customerName: "Andi", items: [{ id: item.json.id, qty: 1 }] });
  assert.equal(idMsg.json.error, "Es Teh sedang habis.");
  const pos = await call("POST", "/api/store/orders", { orderType: "takeaway", items: [{ id: item.json.id, qty: 1 }] }, owner);
  assert.equal(pos.json.error, "Es Teh sedang habis.", "layar kasir tetap bahasa Indonesia");
});

test("QR bawa pulang: mati = tidak dikenal, nyala = pesanan takeaway tanpa meja, kode bisa diganti", async () => {
  const { call, login, db } = await setup();
  const owner = await login("owner@t");
  const kasir = await login("kasir@t");
  const item = await call("POST", "/api/store/items", { category_id: null, name: "Kopi", price: 12000 }, owner);
  assert.equal((await call("PUT", "/api/store/takeaway", { enabled: true }, kasir)).status, 403, "karyawan tidak bisa mengatur");
  const on = await call("PUT", "/api/store/takeaway", { enabled: true }, owner);
  const code = on.json.code as string;
  assert.ok(code.length >= 10);

  const menu = await call("GET", `/api/public/table/${code}`);
  assert.equal(menu.status, 200);
  assert.equal(menu.json.mode, "takeaway");
  assert.equal(menu.json.table, null);

  const ok = await call("POST", "/api/public/orders", { tableCode: code, customerName: "Rani", items: [{ id: item.json.id, qty: 1 }] });
  assert.equal(ok.status, 201);
  const o = db.raw.prepare("SELECT order_type, table_id, source FROM orders").get() as { order_type: string; table_id: string | null; source: string };
  assert.deepEqual(o, { order_type: "takeaway", table_id: null, source: "qr" });
  const st = await call("GET", `/api/public/orders/${ok.json.token}`);
  assert.equal(st.json.order.order_type, "takeaway");
  assert.equal(st.json.order.table_code, code, "tombol pesan lagi kembali ke QR bawa pulang");

  // Dimatikan: QR yang sama tidak bisa dipakai, tapi kodenya tetap untuk dinyalakan lagi.
  await call("PUT", "/api/store/takeaway", { enabled: false }, owner);
  assert.equal((await call("GET", `/api/public/table/${code}`)).status, 404);
  const again = await call("PUT", "/api/store/takeaway", { enabled: true }, owner);
  assert.equal(again.json.code, code);
  const regen = await call("POST", "/api/store/takeaway/regenerate", undefined, owner);
  assert.notEqual(regen.json.code, code);
  assert.equal((await call("GET", `/api/public/table/${code}`)).status, 404, "kode lama mati setelah diganti");
});

test("pengaman lokasi: tandai pesanan dari jauh, tolak di mode ketat, koordinat pembeli tidak disimpan", async () => {
  const { call, login, db } = await setup();
  const owner = await login("owner@t");
  const item = await call("POST", "/api/store/items", { category_id: null, name: "Teh", price: 5000 }, owner);
  await call("POST", "/api/store/tables", { label: "Meja 1" }, owner);
  const code = (db.raw.prepare("SELECT code FROM dining_tables").get() as { code: string }).code;
  const store = { lat: -6.2, lng: 106.816666 };
  const near = { lat: -6.2004, lng: 106.816666, acc: 20 }; // ±45 m
  const far = { lat: -6.23, lng: 106.816666, acc: 15 }; // ±3,3 km
  const order = (loc: unknown) => call("POST", "/api/public/orders", { tableCode: code, customerName: "A", items: [{ id: item.json.id, qty: 1 }], loc });

  assert.equal((await call("PUT", "/api/store/qr-guard", { mode: "flag", lat: null, lng: null, radius: 100 }, owner)).status, 400, "mode nyala wajib ada titik toko");
  assert.equal((await call("PUT", "/api/store/qr-guard", { mode: "flag", ...store, radius: 100 }, owner)).status, 200);
  const menu = await call("GET", `/api/public/table/${code}`);
  assert.deepEqual(menu.json.geo, { check: true, strict: false });
  assert.equal(JSON.stringify(menu.json).includes("106.81"), false, "koordinat toko tidak dikirim ke pembeli");

  assert.equal((await order(near)).status, 201);
  assert.equal((await order(far)).status, 201);
  assert.equal((await order(null)).status, 201);
  const checks = db.raw.prepare("SELECT geo_check, geo_distance_m FROM orders ORDER BY created_at, rowid").all() as { geo_check: string; geo_distance_m: number | null }[];
  assert.deepEqual(checks.map((c) => c.geo_check), ["ok", "far", "unknown"]);
  assert.ok(checks[1].geo_distance_m! > 3000);
  const cols = (db.raw.prepare("PRAGMA table_info(orders)").all() as { name: string }[]).map((c) => c.name);
  assert.equal(cols.some((c) => /lat|lng/.test(c)), false);

  await call("PUT", "/api/store/qr-guard", { mode: "block", ...store, radius: 100 }, owner);
  db.raw.prepare("UPDATE orders SET status = 'done'").run(); // kosongkan batas pesanan berjalan per meja
  assert.equal((await order(near)).status, 201);
  const tooFar = await order(far);
  assert.equal(tooFar.status, 403);
  assert.match(tooFar.json.error, /km dari toko/);
  assert.equal((await order(null)).status, 403, "tanpa izin lokasi ditolak di mode ketat");
  assert.equal((await order({ lat: -6.2, lng: 106.816666, acc: 5000 })).status, 403, "lokasi yang terlalu kabur dianggap tidak diketahui");
});

test("best seller: label tersimpan dan jumlah terjual 30 hari ikut di daftar menu toko", async () => {
  const { call, login, db } = await setup();
  const owner = await login("owner@t");
  const item = await call("POST", "/api/store/items", { category_id: null, name: "Geprek", price: 18000, tags: "bestseller,pedas" }, owner);
  await call("POST", "/api/store/tables", { label: "Meja 1" }, owner);
  const code = (db.raw.prepare("SELECT code FROM dining_tables").get() as { code: string }).code;
  await call("POST", "/api/public/orders", { tableCode: code, customerName: "A", items: [{ id: item.json.id, qty: 3 }] });
  const list = await call("GET", "/api/store/items", undefined, owner);
  assert.equal(list.json.items[0].sold_30d, 3);
  const menu = await call("GET", `/api/public/table/${code}`);
  assert.equal(menu.json.items[0].tags, "bestseller,pedas");
});

test("pesan bareng: dua HP satu keranjang meja, dikirim sekali, nama per item tersimpan", async () => {
  const { call, login, db } = await setup();
  const owner = await login("owner@t");
  const nasi = await call("POST", "/api/store/items", { category_id: null, name: "Nasi", price: 15000 }, owner);
  const teh = await call("POST", "/api/store/items", { category_id: null, name: "Teh", price: 5000 }, owner);
  await call("POST", "/api/store/tables", { label: "Meja 1" }, owner);
  const code = (db.raw.prepare("SELECT code FROM dining_tables").get() as { code: string }).code;

  assert.equal((await call("PUT", `/api/public/table/${code}/cart`, { device: "hpsari0001", person: "Sari", lines: [{ id: nasi.json.id, qty: 2, note: "Pedas sedikit" }] })).status, 200);
  await call("PUT", `/api/public/table/${code}/cart`, { device: "hpbudi0001", person: "Budi", lines: [{ id: teh.json.id, qty: 1 }, { id: "bukan-menu-toko", qty: 1 }] });
  const st = await call("GET", `/api/public/table/${code}/state?device=hpsari0001`);
  assert.equal(st.json.lines.length, 2, "menu asing dibuang");
  assert.equal(st.json.people, 2);
  assert.deepEqual(st.json.lines.map((l: { mine: boolean }) => l.mine), [true, false]);

  // Sari mengganti pilihannya: hanya baris milik HP-nya yang berubah.
  await call("PUT", `/api/public/table/${code}/cart`, { device: "hpsari0001", person: "Sari", lines: [{ id: nasi.json.id, qty: 1, note: "" }] });
  const sent = await call("POST", "/api/public/orders", { tableCode: code, customerName: "Sari", group: true });
  assert.equal(sent.status, 201);
  const o = db.raw.prepare("SELECT id, customer_name, subtotal FROM orders").get() as { id: string; customer_name: string; subtotal: number };
  assert.equal(o.subtotal, 20000);
  assert.equal(o.customer_name, "Sari, Budi");
  const persons = (db.raw.prepare("SELECT person FROM order_items WHERE order_id = ? ORDER BY person").all(o.id) as { person: string }[]).map((r) => r.person);
  assert.deepEqual(persons, ["Budi", "Sari"]);
  const after = await call("GET", `/api/public/table/${code}/state?device=hpbudi0001`);
  assert.equal(after.json.lines.length, 0, "keranjang meja kosong setelah dikirim");
  assert.equal(after.json.orders[0].number, sent.json.number, "HP lain melihat pesanan meja yang terkirim");
  assert.equal((await call("POST", "/api/public/orders", { tableCode: code, customerName: "Sari", group: true })).status, 400, "keranjang kosong ditolak");
});

test("panggil pelayan: tidak dobel, muncul di papan kasir, ditandai selesai, bukan untuk QR bawa pulang", async () => {
  const { call, login, db } = await setup();
  const owner = await login("owner@t");
  const kasir = await login("kasir@t");
  await call("POST", "/api/store/tables", { label: "Meja 2" }, owner);
  const code = (db.raw.prepare("SELECT code FROM dining_tables").get() as { code: string }).code;
  assert.equal((await call("POST", `/api/public/table/${code}/calls`, { kind: "waiter" })).status, 201);
  assert.equal((await call("POST", `/api/public/table/${code}/calls`, { kind: "waiter" })).status, 200, "panggilan sama tidak digandakan");
  assert.equal((await call("POST", `/api/public/table/${code}/calls`, { kind: "bill" })).status, 201);
  const board = await call("GET", "/api/store/orders?scope=active", undefined, kasir);
  assert.equal(board.json.calls.length, 2);
  assert.equal(board.json.calls[0].table_label, "Meja 2");
  assert.equal((await call("POST", `/api/store/calls/${board.json.calls[0].id}/done`, undefined, kasir)).status, 200);
  await call("DELETE", `/api/public/table/${code}/calls/bill`);
  assert.equal((await call("GET", "/api/store/orders?scope=active", undefined, kasir)).json.calls.length, 0);
  const st = await call("GET", `/api/public/table/${code}/state`);
  assert.equal(st.json.calls.length, 0);

  const tw = await call("PUT", "/api/store/takeaway", { enabled: true }, owner);
  assert.equal((await call("POST", `/api/public/table/${tw.json.code}/calls`, { kind: "waiter" })).status, 400);
});

// ---------- Fitur operasional & pelanggan ----------
import { clockAt } from "../../shared/schedule";

test("kasir offline: pesanan tersinkron dengan waktu asli, tidak ditolak stok/habis, kiriman ulang tidak dobel", async () => {
  const { call, login, db } = await setup();
  const owner = await login("owner@t");
  const kasir = await login("kasir@t");
  const air = await call("POST", "/api/store/items", { category_id: null, name: "Air", price: 4000, track_stock: 1 }, owner);
  await call("POST", "/api/store/stock/movements", { itemId: air.json.id, mode: "restock", qty: 1 }, owner);
  await call("PATCH", `/api/store/items/${air.json.id}/availability`, { available: false }, owner);
  const at = Date.now() - 2 * 3600_000;
  const body = { orderType: "takeaway", items: [{ id: air.json.id, qty: 3 }], payment: { method: "cash", amountReceived: 5000 }, clientId: "dev-1234-abcd", offlineAt: at };
  const r1 = await call("POST", "/api/store/orders", body, kasir);
  assert.equal(r1.status, 201, JSON.stringify(r1.json));
  const r2 = await call("POST", "/api/store/orders", body, kasir);
  assert.equal(r2.status, 200);
  assert.equal(r2.json.number, r1.json.number);
  const rows = db.raw.prepare("SELECT created_at, paid_at, offline FROM orders").all() as { created_at: number; paid_at: number; offline: number }[];
  assert.equal(rows.length, 1, "tidak dobel");
  assert.equal(rows[0].created_at, at);
  assert.equal(rows[0].paid_at, at);
  assert.equal(rows[0].offline, 1);
  assert.equal((db.raw.prepare("SELECT stock_qty FROM menu_items").get() as { stock_qty: number }).stock_qty, 0, "stok turun sampai nol, tidak minus");
  // Tanpa tanda offline, menu habis tetap ditolak.
  assert.equal((await call("POST", "/api/store/orders", { ...body, clientId: undefined, offlineAt: undefined }, kasir)).status, 409);
});

test("shift kasir: satu shift terbuka, isi laci seharusnya, selisih saat tutup, riwayat hanya manajemen", async () => {
  const { call, login } = await setup();
  const owner = await login("owner@t");
  const kasir = await login("kasir@t");
  const nasi = await call("POST", "/api/store/items", { category_id: null, name: "Nasi", price: 20000 }, owner);
  const open = await call("POST", "/api/store/shifts/open", { opening_cash: 100000 }, kasir);
  assert.equal(open.status, 201);
  assert.equal((await call("POST", "/api/store/shifts/open", { opening_cash: 0 }, owner)).status, 409);
  const cash = await call("POST", "/api/store/orders", { orderType: "takeaway", items: [{ id: nasi.json.id, qty: 1 }], payment: { method: "cash", amountReceived: 50000 } }, kasir);
  await call("POST", "/api/store/orders", { orderType: "takeaway", items: [{ id: nasi.json.id, qty: 2 }], payment: { method: "qris", amountReceived: null } }, kasir);
  assert.equal((await call("POST", `/api/store/shifts/${open.json.id}/moves`, { kind: "out", amount: 5000, note: "Beli es batu" }, kasir)).status, 201);
  const cur = await call("GET", "/api/store/shifts/current", undefined, kasir);
  assert.equal(cur.json.summary.cash_sales, cash.json.total);
  assert.equal(cur.json.summary.expected, 100000 + cash.json.total - 5000);
  assert.equal(cur.json.summary.byMethod.length, 2);
  const feed = await call("GET", "/api/store/orders?scope=active", undefined, kasir);
  assert.equal(feed.json.shift_open, true);
  const close = await call("POST", `/api/store/shifts/${open.json.id}/close`, { counted_cash: 100000 + cash.json.total - 7000 }, kasir);
  assert.equal(close.json.diff, -2000);
  assert.equal((await call("GET", "/api/store/shifts", undefined, kasir)).status, 403);
  const hist = await call("GET", "/api/store/shifts", undefined, owner);
  assert.equal(hist.json.shifts[0].counted_cash - hist.json.shifts[0].expected_cash, -2000);
});

test("layar dapur: item dibagi dapur/bar, pesanan jadi siap saat semua bagian selesai", async () => {
  const { call, login } = await setup();
  const owner = await login("owner@t");
  const kasir = await login("kasir@t");
  const minum = await call("POST", "/api/store/categories", { name: "Minuman" }, owner);
  const makan = await call("POST", "/api/store/categories", { name: "Makanan" }, owner);
  const cats = await call("GET", "/api/store/categories", undefined, owner);
  assert.deepEqual(cats.json.categories.map((c: { station: string }) => c.station), ["bar", "kitchen"], "kategori minuman otomatis ke bar");
  const teh = await call("POST", "/api/store/items", { category_id: minum.json.id, name: "Teh", price: 5000 }, owner);
  const mie = await call("POST", "/api/store/items", { category_id: makan.json.id, name: "Mie", price: 15000, prep_minutes: 8 }, owner);
  const o = await call("POST", "/api/store/orders", { orderType: "takeaway", items: [{ id: teh.json.id, qty: 1 }, { id: mie.json.id, qty: 2 }] }, kasir);
  const bar = await call("GET", "/api/store/kitchen?station=bar", undefined, kasir);
  assert.equal(bar.json.orders.length, 1);
  assert.deepEqual(bar.json.orders[0].items.map((i: { name: string }) => i.name), ["Teh"]);
  assert.equal(bar.json.orders[0].other_open, 1);
  const r1 = await call("PATCH", `/api/store/kitchen/items/${bar.json.orders[0].items[0].id}`, { ready: true }, kasir);
  assert.equal(r1.json.advanced, false);
  assert.equal((await call("GET", "/api/store/kitchen?station=bar", undefined, kasir)).json.orders.length, 0, "bagian bar sudah selesai");
  const kitchen = await call("GET", "/api/store/kitchen?station=kitchen", undefined, kasir);
  assert.equal(kitchen.json.orders[0].items[0].prep_minutes, 8);
  const r2 = await call("POST", `/api/store/kitchen/orders/${o.json.id}/done`, { station: "kitchen" }, kasir);
  assert.equal(r2.json.advanced, true);
  const feed = await call("GET", "/api/store/orders?scope=active", undefined, kasir);
  assert.equal(feed.json.orders[0].status, "ready");
});

test("menu per jam & happy hour: di luar jam ditolak, diskon otomatis dengan harga normal tercatat", async () => {
  const { call, login, db } = await setup();
  const owner = await login("owner@t");
  const kasir = await login("kasir@t");
  const now = clockAt(Date.now(), 420).min;
  const minum = await call("POST", "/api/store/categories", { name: "Minuman" }, owner);
  const bubur = await call("POST", "/api/store/items", { category_id: null, name: "Bubur", price: 12000, avail_from: (now + 120) % 1440, avail_to: (now + 180) % 1440 }, owner);
  const kopi = await call("POST", "/api/store/items", { category_id: minum.json.id, name: "Kopi", price: 15000 }, owner);
  assert.equal((await call("POST", "/api/store/items", { category_id: null, name: "X", price: 1, avail_from: 60, avail_to: null }, owner)).status, 400);
  await call("POST", "/api/store/tables", { label: "Meja 1" }, owner);
  const code = (db.raw.prepare("SELECT code FROM dining_tables").get() as { code: string }).code;
  const off = await call("POST", "/api/public/orders", { tableCode: code, customerName: "A", items: [{ id: bubur.json.id, qty: 1 }] });
  assert.equal(off.status, 409);
  assert.match(off.json.error, /hanya tersedia/);
  assert.equal((await call("POST", "/api/store/orders", { orderType: "takeaway", items: [{ id: bubur.json.id, qty: 1 }] }, kasir)).status, 409);
  const rule = await call("POST", "/api/store/price-rules", { name: "Happy hour", percent: 20, days: 127, start_min: (now + 1410) % 1440, end_min: (now + 30) % 1440, category_ids: [minum.json.id] }, owner);
  assert.equal(rule.status, 201);
  assert.equal((await call("POST", "/api/store/price-rules", { name: "X", percent: 20, days: 127, start_min: 10, end_min: 20 }, kasir)).status, 403);
  const menu = await call("GET", `/api/public/table/${code}`);
  assert.equal(menu.json.pricing.rules.length, 1);
  const ok = await call("POST", "/api/public/orders", { tableCode: code, customerName: "A", items: [{ id: kopi.json.id, qty: 2 }] });
  assert.equal(ok.status, 201);
  const it = db.raw.prepare("SELECT price, list_price FROM order_items").get() as { price: number; list_price: number };
  assert.deepEqual(it, { price: 12000, list_price: 15000 });
  const rep = await call("GET", "/api/store/analytics?range=today", undefined, owner);
  assert.equal(rep.status, 200);
});

test("ulasan: setelah diantar, sekali per pesanan, tautan Google untuk semua nilai, masuk laporan", async () => {
  const { call, login, db } = await setup();
  const owner = await login("owner@t");
  const kasir = await login("kasir@t");
  const nasi = await call("POST", "/api/store/items", { category_id: null, name: "Nasi", price: 15000 }, owner);
  await call("POST", "/api/store/tables", { label: "Meja 1" }, owner);
  const code = (db.raw.prepare("SELECT code FROM dining_tables").get() as { code: string }).code;
  assert.equal((await call("PUT", "/api/store/settings", { name: "Toko Uji", kind: "warung", address: "", phone: "", welcome_note: "", tax_rate: 10, service_rate: 5, inventory_enabled: true, qr_ordering_enabled: true, logo_url: null, google_review_url: "https://evil.example/x" }, owner)).status, 400);
  assert.equal((await call("PUT", "/api/store/settings", { name: "Toko Uji", kind: "warung", address: "", phone: "", welcome_note: "", tax_rate: 10, service_rate: 5, inventory_enabled: true, qr_ordering_enabled: true, logo_url: null, google_review_url: "https://g.page/r/abc/review" }, owner)).status, 200);
  const o = await call("POST", "/api/public/orders", { tableCode: code, customerName: "A", items: [{ id: nasi.json.id, qty: 1 }] });
  const early = await call("POST", `/api/public/orders/${o.json.token}/feedback`, { rating: 5 });
  assert.equal(early.status, 409);
  const id = (db.raw.prepare("SELECT id FROM orders").get() as { id: string }).id;
  for (const s of ["preparing", "ready", "done"]) await call("PATCH", `/api/store/orders/${id}/status`, { status: s }, kasir);
  const fb = await call("POST", `/api/public/orders/${o.json.token}/feedback`, { rating: 2, comment: "Agak asin", items: [{ id: nasi.json.id, liked: false }, { id: "lain", liked: true }] });
  assert.equal(fb.status, 201);
  assert.equal(fb.json.review_url, "https://g.page/r/abc/review", "nilai rendah pun tetap ditawari tautan Google");
  assert.equal((await call("POST", `/api/public/orders/${o.json.token}/feedback`, { rating: 5 })).status, 409);
  const st = await call("GET", `/api/public/orders/${o.json.token}`);
  assert.equal(st.json.feedback.sent, true);
  const rep = await call("GET", "/api/store/analytics?range=today", undefined, owner);
  assert.equal(rep.json.feedback.count, 1);
  assert.equal(rep.json.feedback.recent[0].comment, "Agak asin");
  assert.deepEqual(rep.json.feedback.items, [{ name: "Nasi", likes: 0, dislikes: 1 }]);
});

test("kartu stempel: nomor HP dinormalkan, satu stempel per pesanan, minimal belanja, tukar hadiah", async () => {
  const { call, login, db } = await setup();
  const owner = await login("owner@t");
  const kasir = await login("kasir@t");
  const nasi = await call("POST", "/api/store/items", { category_id: null, name: "Nasi", price: 15000 }, owner);
  const teh = await call("POST", "/api/store/items", { category_id: null, name: "Teh", price: 3000 }, owner);
  assert.equal((await call("PUT", "/api/store/loyalty", { enabled: true, target: 2, min_spend: 10000, reward: "" }, owner)).status, 400, "hadiah wajib diisi");
  assert.equal((await call("PUT", "/api/store/loyalty", { enabled: true, target: 2, min_spend: 10000, reward: "1 Es Teh gratis" }, owner)).status, 200);
  const pos = (id: string, phone: string) => call("POST", "/api/store/orders", { orderType: "takeaway", items: [{ id, qty: 1 }], payment: { method: "cash", amountReceived: null }, phone }, kasir);
  const a = await pos(nasi.json.id, "0812-3456-7890");
  assert.equal(a.json.loyalty.stamped, true);
  assert.equal(a.json.loyalty.card.phone, "6281234567890");
  const small = await pos(teh.json.id, "+62 812 3456 7890");
  assert.equal(small.json.loyalty.stamped, false, "di bawah minimal belanja");
  assert.equal((await call("POST", "/api/store/loyalty/stamp", { orderId: a.json.id, phone: "081234567890" }, kasir)).json.stamped, false, "pesanan yang sama tidak dapat stempel lagi");
  const b = await pos(nasi.json.id, "081234567890");
  assert.equal(b.json.loyalty.card.ready, true);
  const look = await call("GET", "/api/store/loyalty/lookup?phone=081234567890", undefined, kasir);
  assert.equal(look.json.card.stamps, 2);
  const red = await call("POST", "/api/store/loyalty/redeem", { phone: "081234567890" }, kasir);
  assert.equal(red.json.card.stamps, 0);
  assert.equal(red.json.card.rewards, 1);
  assert.equal((await call("POST", "/api/store/loyalty/redeem", { phone: "081234567890" }, kasir)).status, 409);
  assert.equal((await call("GET", "/api/store/loyalty", undefined, kasir)).status, 403, "daftar pelanggan hanya manajemen");

  // Pembeli QR mengambil stempel sendiri setelah bayar.
  await call("POST", "/api/store/tables", { label: "Meja 1" }, owner);
  const code = (db.raw.prepare("SELECT code FROM dining_tables").get() as { code: string }).code;
  const q = await call("POST", "/api/public/orders", { tableCode: code, customerName: "Dewi", items: [{ id: nasi.json.id, qty: 1 }] });
  assert.equal((await call("POST", `/api/public/orders/${q.json.token}/stamp`, { phone: "085711112222" })).status, 409, "belum dibayar");
  const qid = (db.raw.prepare("SELECT id FROM orders WHERE public_token = ?").get(q.json.token) as { id: string }).id;
  await call("PATCH", `/api/store/orders/${qid}/status`, { status: "preparing" }, kasir);
  await call("PATCH", `/api/store/orders/${qid}/pay`, { method: "qris", amountReceived: null }, kasir);
  assert.equal((await call("POST", `/api/public/orders/${q.json.token}/stamp`, { phone: "12" })).status, 400);
  const claim = await call("POST", `/api/public/orders/${q.json.token}/stamp`, { phone: "085711112222" });
  assert.equal(claim.status, 200);
  assert.equal(claim.json.card.stamps, 1);
  assert.equal((await call("POST", `/api/public/orders/${q.json.token}/stamp`, { phone: "085799998888" })).status, 409);
  const st = await call("GET", `/api/public/orders/${q.json.token}`);
  assert.equal(st.json.loyalty.card.stamps, 1);
  assert.equal(JSON.stringify(st.json).includes("6285711112222"), false, "nomor HP tidak dikirim balik ke halaman publik");
});

test("antrean tunggu: harus dinyalakan, posisi dihitung, kasir memanggil dan mendudukkan", async () => {
  const { call, login } = await setup();
  const owner = await login("owner@t");
  const kasir = await login("kasir@t");
  const s = await call("PUT", "/api/store/waitlist-settings", { enabled: false }, owner);
  const code = s.json.code;
  assert.equal((await call("POST", `/api/public/waitlist/${code}`, { name: "A", party: 2 })).status, 403);
  await call("PUT", "/api/store/waitlist-settings", { enabled: true }, owner);
  const a = await call("POST", `/api/public/waitlist/${code}`, { name: "Andi", party: 2 });
  const b = await call("POST", `/api/public/waitlist/${code}`, { name: "Budi", party: 4, phone: "0812 1111 2222" });
  assert.equal(b.status, 201);
  assert.equal(b.json.number, a.json.number + 1);
  assert.equal((await call("POST", `/api/public/waitlist/${code}`, { name: "C", party: 1, phone: "abc" })).status, 400);
  assert.equal((await call("GET", `/api/public/waitlist/entry/${b.json.token}`)).json.ahead, 1);
  const list = await call("GET", "/api/store/waitlist", undefined, kasir);
  assert.equal(list.json.open.length, 2);
  assert.equal(list.json.open[1].phone, "6281211112222");
  const feed = await call("GET", "/api/store/orders?scope=active", undefined, kasir);
  assert.equal(feed.json.waiting.length, 2);
  const first = list.json.open[0].id;
  assert.equal((await call("PATCH", `/api/store/waitlist/${first}`, { status: "called" }, kasir)).status, 200);
  assert.equal((await call("GET", `/api/public/waitlist/entry/${a.json.token}`)).json.entry.status, "called");
  assert.equal((await call("GET", `/api/public/waitlist/entry/${b.json.token}`)).json.ahead, 0);
  assert.equal((await call("PATCH", `/api/store/waitlist/${first}`, { status: "seated", table_label: "Meja 3" }, kasir)).status, 200);
  assert.equal((await call("PATCH", `/api/store/waitlist/${first}`, { status: "called" }, kasir)).status, 409);
  await call("DELETE", `/api/public/waitlist/entry/${b.json.token}`);
  assert.equal((await call("GET", "/api/store/waitlist", undefined, kasir)).json.open.length, 0);
});

test("saran pasangan & margin: pasangan pilihan pemilik tampil di menu, modal tercatat saat terjual", async () => {
  const { call, login, db } = await setup();
  const owner = await login("owner@t");
  const kasir = await login("kasir@t");
  const teh = await call("POST", "/api/store/items", { category_id: null, name: "Teh", price: 5000, cost: 1500 }, owner);
  const nasi = await call("POST", "/api/store/items", { category_id: null, name: "Nasi", price: 20000, cost: 9000, pair_ids: [teh.json.id, "asing"] }, owner);
  await call("POST", "/api/store/tables", { label: "Meja 1" }, owner);
  const code = (db.raw.prepare("SELECT code FROM dining_tables").get() as { code: string }).code;
  const menu = await call("GET", `/api/public/table/${code}`);
  const n = menu.json.items.find((i: { id: string }) => i.id === nasi.json.id);
  assert.deepEqual(n.pairs, [teh.json.id]);
  assert.equal(n.cost, undefined, "modal tidak bocor ke pembeli");
  await call("POST", "/api/store/orders", { orderType: "takeaway", items: [{ id: nasi.json.id, qty: 2 }, { id: teh.json.id, qty: 1 }], payment: { method: "cash", amountReceived: null } }, kasir);
  const rep = await call("GET", "/api/store/analytics?range=today", undefined, owner);
  const m = rep.json.margins.find((x: { name: string }) => x.name === "Nasi");
  assert.equal(m.revenue, 40000);
  assert.equal(m.cost, 18000);
  assert.equal(rep.json.costCoverage.costed, 2);
});
