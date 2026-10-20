// Uji alur toko barang & tagihan meja di browser sungguhan: varian, scan barcode (alat scan & kolom cari),
// cetak label, stok per varian, mode toko, varian di menu QR, tagihan meja gabungan.
// Pakai: node tests/retail.mjs <folder-output>   (API + vite jalan, database berisi data contoh baru)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2] ?? "retail-out";
const BASE = process.env.BASE ?? "http://localhost:5173";
mkdirSync(OUT, { recursive: true });
const errors = [];
const ok = [];
const check = (cond, msg) => (cond ? ok.push(msg) : errors.push(`GAGAL: ${msg}`));

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium",
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
async function ctx(vp = { width: 1280, height: 860 }) {
  const c = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: "id-ID", permissions: ["camera"] });
  const p = await c.newPage();
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text()) && errors.push(`console ${p.url()} ${m.text()}`));
  p.on("pageerror", (e) => errors.push(`pageerror ${p.url()} ${e.message}`));
  return { c, p };
}
async function login(p, user) {
  await p.goto(`${BASE}/masuk`);
  await p.fill("#l-login", user);
  await p.fill("#l-pw", "contoh12345");
  await p.click("form .btn-primary");
  await p.waitForURL(/\/toko/);
}
const api = async (p, method, path, body) =>
  p.evaluate(async ([m, u, b]) => {
    const r = await fetch(u, { method: m, headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
    return { status: r.status, json: await r.json().catch(() => null) };
  }, [method, path, body]);
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

// ---------- 1. Toko barang: kasir, scan, varian ----------
{
  const { c, p } = await ctx();
  await login(p, "toko@contoh.id");
  await p.waitForURL(/\/toko\/kasir/);
  check(true, "toko barang: setelah masuk langsung ke Kasir");
  const nav = await p.locator(".sidebar").innerText();
  check(!/Layar dapur|Meja & QR|Antrean tunggu|Tampilan menu/.test(nav) && /Produk/.test(nav) && /Penjualan/.test(nav), "toko barang: menu tanpa dapur, meja, antrean");
  await p.waitForSelector(".pos-item");
  const items = (await api(p, "GET", "/api/store/items")).json.items;
  const kaos = items.find((i) => i.name.startsWith("Kaos Polos"));
  const v = kaos.variants.find((x) => x.opt1 === "Hitam" && x.opt2 === "M");
  const before = v.stock_qty;
  // Alat scan USB: mengetik cepat lalu Enter, tanpa fokus di kolom mana pun.
  await p.locator("body").click({ position: { x: 5, y: 5 } });
  await p.keyboard.type(v.barcode, { delay: 8 });
  await p.keyboard.press("Enter");
  await p.waitForSelector(".cart-line");
  check((await p.locator(".cart-line").first().innerText()).includes("Hitam / M"), "kasir: scan alat barcode menambah varian yang tepat");
  // Kode diketik di kolom cari lalu Enter
  const topi = items.find((i) => i.name === "Topi Baseball").variants[0];
  await p.fill('input[aria-label="Cari produk atau barcode"]', topi.barcode);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(300);
  check((await p.locator(".cart-line").count()) === 2, "kasir: barcode diketik di kolom cari ikut masuk");
  // Barcode tidak dikenal
  await p.locator("body").click({ position: { x: 5, y: 5 } });
  await p.keyboard.type("9999999999999", { delay: 8 });
  await p.keyboard.press("Enter");
  await p.waitForSelector("text=belum terdaftar");
  check(true, "kasir: barcode tak dikenal memberi pesan jelas");
  // Ketuk produk bervarian: muncul pilihan
  await p.locator(".pos-item", { hasText: "Kemeja Flanel" }).click();
  await p.waitForSelector(".vp");
  const addBtn = p.getByRole("button", { name: "Tambah ke keranjang" });
  check(await addBtn.isDisabled(), "kasir: varian wajib dipilih dulu");
  await p.locator(".vp-opt", { hasText: "Biru" }).click();
  await p.locator(".vp-opt", { hasText: /^L$/ }).click();
  await p.screenshot({ path: `${OUT}/01-pilih-varian-pc.png` });
  await addBtn.click();
  await p.waitForTimeout(200);
  check((await p.locator(".cart-lines").innerText()).includes("Biru / L"), "kasir: varian terpilih masuk keranjang");
  // Kamera: terbuka dan tertutup tanpa galat (kamera palsu, tanpa barcode)
  await p.getByRole("button", { name: "Scan barcode dengan kamera" }).click();
  await p.waitForSelector(".scan");
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${OUT}/02-scan-kamera.png` });
  await p.getByRole("button", { name: "Tutup kamera" }).click();
  check((await p.locator(".scan").count()) === 0, "kasir: layar scan kamera bisa dibuka dan ditutup");
  await p.screenshot({ path: `${OUT}/03-kasir-toko-pc.png` });
  // Bayar
  await p.getByRole("button", { name: "Bayar sekarang" }).click();
  await p.locator("dialog[open]").getByRole("button", { name: /Uang pas/ }).click().catch(() => {});
  await p.locator("dialog[open] .modal-foot .btn-primary").click();
  await p.waitForSelector("text=Kirim struk digital ke WhatsApp", { timeout: 8000 }).catch(() => {});
  const after = (await api(p, "GET", "/api/store/items")).json.items.find((i) => i.id === kaos.id).variants.find((x) => x.id === v.id).stock_qty;
  check(after === before - 1, `stok varian berkurang setelah dibayar (${before} → ${after})`);
  const hist = (await api(p, "GET", "/api/store/orders?scope=history")).json.orders[0];
  check(hist.status === "done" && hist.payment_status === "paid", "toko barang: penjualan langsung selesai, tidak masuk dapur");
  check(hist.items.some((i) => i.name === "Kemeja Flanel (Biru / L)"), "riwayat: nama varian tercatat");
  check(!(await overflow(p)), "kasir toko: tanpa geser samping");
  await c.close();
}

// ---------- 2. Produk: editor varian, label, stok ----------
{
  const { c, p } = await ctx();
  await login(p, "toko@contoh.id");
  await p.goto(`${BASE}/toko/menu`);
  await p.waitForSelector(".menu-row");
  check((await p.locator("h1").innerText()).includes("Produk"), "produk: judul Produk di mode toko");
  await p.getByRole("button", { name: /Ubah Kaos Polos/ }).click();
  await p.waitForSelector(".ve-row");
  check((await p.locator(".ve-row").count()) === 12, "editor: 3 warna × 4 ukuran = 12 varian");
  // Tambah warna baru → kombinasi bertambah
  await p.fill("#ve-v1", "Hitam, Putih, Navy, Abu");
  check((await p.locator(".ve-row").count()) === 16, "editor: tambah warna membuat kombinasi baru");
  await p.screenshot({ path: `${OUT}/04-editor-varian-pc.png` });
  const rows = p.locator(".ve-row", { hasText: "Abu" });
  await rows.first().locator('input[inputmode="numeric"]').nth(1).fill("7").catch(() => {});
  await p.getByRole("button", { name: "Barcode untuk yang kosong" }).click();
  await p.getByRole("button", { name: "Simpan perubahan" }).click();
  await p.waitForSelector("text=Perubahan disimpan");
  const kaos = (await api(p, "GET", "/api/store/items")).json.items.find((i) => i.name.startsWith("Kaos Polos"));
  check(kaos.variants.length === 16 && kaos.variants.every((x) => x.barcode), "editor: 16 varian tersimpan, semua punya barcode");
  // Cetak label
  await p.getByRole("button", { name: "Cetak label" }).click();
  await p.getByRole("button", { name: "1 per barang" }).click();
  const n = Number((await p.locator("dialog[open] .modal-foot .btn-primary").innerText()).match(/\d+/)[0]);
  check(n >= 16, `label: ${n} label siap dicetak`);
  await p.screenshot({ path: `${OUT}/05-label-pc.png` });
  await p.keyboard.press("Escape");
  // Stok per varian
  await p.goto(`${BASE}/toko/stok`);
  await p.waitForSelector(".stock-variant");
  check((await p.locator(".stock-variant").count()) >= 16, "stok: baris per varian tampil");
  await p.locator(".stock-variant", { hasText: "Abu / S" }).getByRole("button", { name: /Barang masuk/ }).click();
  await p.fill("#mv-qty", "5");
  await p.locator("dialog[open] .modal-foot .btn-primary").click();
  await p.waitForSelector("text=Stok Kaos Polos");
  check(true, "stok: barang masuk per varian tersimpan");
  await p.screenshot({ path: `${OUT}/06-stok-varian-pc.png` });
  await c.close();
}

// ---------- 3. HP: kasir toko & editor ----------
{
  const { c, p } = await ctx({ width: 390, height: 844 });
  await login(p, "toko@contoh.id");
  await p.waitForSelector(".pos-item");
  await p.screenshot({ path: `${OUT}/07-kasir-toko-hp.png` });
  check(!(await overflow(p)), "kasir toko HP: tanpa geser samping");
  await p.goto(`${BASE}/toko/menu`);
  await p.getByRole("button", { name: /Ubah Celana Chino/ }).click();
  await p.waitForSelector(".ve-row");
  await p.locator(".ve-row").first().scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}/08-editor-varian-hp.png` });
  check(!(await overflow(p)), "editor varian HP: tanpa geser samping");
  await c.close();
}

// ---------- 4. Warung: varian di menu QR, tagihan meja gabungan ----------
{
  const { c, p } = await ctx({ width: 390, height: 844 });
  await p.goto(`${BASE}/m/contoh-meja1`);
  await p.waitForSelector(".dish");
  await p.locator(".dish", { hasText: "Teh Tarik" }).click();
  await p.waitForSelector(".vp");
  const btn = p.locator("dialog[open] .btn-primary.btn-lg");
  check(await btn.isDisabled(), "menu QR: tombol tambah terkunci sebelum varian dipilih");
  await p.locator(".vp-opt", { hasText: "Es" }).click();
  check((await btn.innerText()).includes("12.000"), "menu QR: harga ikut varian Es");
  await p.screenshot({ path: `${OUT}/09-varian-menu-qr-hp.png` });
  await btn.click();
  await p.locator(".dish", { hasText: "Tahu Crispy" }).click();
  await p.locator("dialog[open] .btn-primary.btn-lg").click();
  await p.locator(".cartbar").click();
  check((await p.locator("dialog[open]").innerText()).includes("Es"), "keranjang: varian tampil");
  await p.fill("#c-name", "Uji Tagihan");
  await p.locator("dialog[open] .modal-foot .btn-primary").click();
  await p.waitForURL(/pesanan/);
  await p.waitForSelector(".ticket-items");
  check((await p.locator(".ticket-items").innerText()).includes("Teh Tarik (Es)"), "status pesanan: nama varian tampil");
  // Pesanan kedua dari meja yang sama
  await p.goto(`${BASE}/m/contoh-meja1`);
  await p.waitForSelector(".dish");
  await p.locator(".dish", { hasText: "Pisang Goreng" }).click();
  await p.locator("dialog[open] .btn-primary.btn-lg").click();
  await p.locator(".cartbar").click();
  await p.locator("dialog[open] .modal-foot .btn-primary").click();
  await p.waitForURL(/pesanan/);
  await p.goto(`${BASE}/m/contoh-meja1`);
  await p.waitForSelector(".bill-chip", { timeout: 10000 }).catch(() => {});
  check((await p.locator(".bill-chip").count()) === 1, "menu QR: tagihan meja tampil di atas");
  await p.locator(".bill-chip").click();
  await p.waitForSelector(".bill-box");
  check((await p.locator(".bill-box").innerText()).includes("Teh Tarik (Es)"), "tagihan meja: rincian pesanan tampil di HP pembeli");
  await p.screenshot({ path: `${OUT}/10-tagihan-meja-hp.png` });
  // Kasir: tab Tagihan menggabungkan meja
  const { c: c2, p: k } = await ctx();
  await login(k, "kasir@contoh.id");
  await k.goto(`${BASE}/toko/pesanan`);
  await k.getByRole("button", { name: /^Tagihan/ }).click();
  await k.waitForSelector(".bill-card");
  const card = k.locator(".bill-card", { hasText: "Meja 1" });
  const txt = await card.innerText();
  check(/Total \d+ pesanan/.test(txt), `kasir: pesanan Meja 1 digabung jadi satu tagihan`);
  await k.screenshot({ path: `${OUT}/11-tagihan-kasir-pc.png` });
  await card.getByRole("button", { name: /Terima bayar/ }).click();
  await k.locator("dialog[open]").getByRole("button", { name: /QRIS/ }).click().catch(() => {});
  await k.locator("dialog[open] .modal-foot .btn-primary").click();
  await k.waitForSelector("text=lunas");
  check((await k.locator(".bill-card", { hasText: "Meja 1" }).count()) === 0, "kasir: tagihan meja lunas sekaligus");
  // Kas: peringatan tagihan belum dibayar (kalau masih ada)
  await k.goto(`${BASE}/toko/kas`);
  await k.waitForSelector("text=Tutup shift");
  await k.screenshot({ path: `${OUT}/12-kas-pc.png` });
  await c2.close();
  await c.close();
}

await browser.close();
for (const m of ok) console.log(`OK  ${m}`);
console.log(errors.length ? `\nMASALAH:\n${errors.join("\n")}` : "\nSemua lolos.");
process.exit(errors.length ? 1 : 0);
