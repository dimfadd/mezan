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

async function setup() {
  const db = openNodeDb(":memory:");
  migrate(db.raw, resolve("server/migrations"), false);
  const app = createApp({ db, storage });
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
  const mine = await call("POST", "/api/store/items", { category_id: null, name: "Pasang media asing", price: 1, image_url: `/media/${otherTenant}/a.png` }, owner);
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
  assert.equal((await call("GET", `/api/public/table/${code}`)).json.store.theme.headingFont, "fraunces");
});
