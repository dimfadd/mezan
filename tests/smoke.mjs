// Uji asap tampilan: buka halaman utama di 3 ukuran layar, simpan screenshot, laporkan error console.
// Pakai: node tests/smoke.mjs <folder-output>   (server API + vite harus sudah jalan)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2] ?? "smoke-out";
const BASE = process.env.BASE ?? "http://localhost:5173";
mkdirSync(OUT, { recursive: true });
const sizes = { hp: { width: 390, height: 844 }, tablet: { width: 820, height: 1180 }, pc: { width: 1440, height: 900 } };
const errors = [];

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });

async function ctx(size, theme = "light") {
  const c = await browser.newContext({ viewport: sizes[size], colorScheme: theme, deviceScaleFactor: 1 });
  const p = await c.newPage();
  p.on("console", (m) => m.type() === "error" && errors.push(`[${size}] ${p.url()} ${m.text()}`));
  p.on("pageerror", (e) => errors.push(`[${size}] ${p.url()} ${e.message}`));
  return { c, p };
}

async function login(p, user) {
  await p.goto(`${BASE}/masuk`);
  await p.fill("#l-login", user);
  await p.fill("#l-pw", user.startsWith("admin") ? "admin12345" : "contoh12345");
  await p.click("form .btn-primary");
  await p.waitForURL(/\/(toko|admin)/);
}

async function overflow(p, name) {
  const w = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  if (w[0] > w[1] + 1) errors.push(`OVERFLOW ${name}: scrollWidth ${w[0]} > ${w[1]}`);
}

async function shot(p, name) {
  await p.waitForTimeout(500);
  await overflow(p, name);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

// Pelanggan
for (const theme of ["light", "dark"]) {
  const { c, p } = await ctx("hp", theme);
  await p.goto(`${BASE}/m/contoh-meja1`);
  await p.waitForSelector(".dish");
  await shot(p, `cust-menu-hp-${theme}`);
  await p.locator(".dish").first().click();
  await p.waitForSelector("dialog[open]");
  await p.screenshot({ path: `${OUT}/cust-dish-hp-${theme}.png` });
  await p.click("dialog[open] .btn-primary");
  await p.click(".cartbar");
  await p.waitForSelector("dialog[open]");
  await p.screenshot({ path: `${OUT}/cust-cart-hp-${theme}.png` });
  await c.close();
}
{
  const { c, p } = await ctx("pc");
  await p.goto(`${BASE}/m/contoh-meja1`);
  await p.waitForSelector(".dish");
  await shot(p, "cust-menu-pc");
  await p.goto(`${BASE}/`);
  await shot(p, "landing-pc");
  await p.goto(`${BASE}/masuk`);
  await shot(p, "login-pc");
  await c.close();
}
{
  const { c, p } = await ctx("hp");
  await p.goto(`${BASE}/`);
  await shot(p, "landing-hp");
  // Antrean tamu dari QR pintu
  await p.goto(`${BASE}/antre/contoh-antre`);
  await p.waitForSelector("#w-name");
  await shot(p, "antre-daftar-hp");
  // Halaman hukum
  for (const pg of ["syarat", "privasi"]) {
    await p.goto(`${BASE}/${pg}`);
    await p.waitForSelector(".legal-toc");
    await shot(p, `${pg}-hp`);
  }
  await c.close();
}

// Toko (pemilik)
const pages = ["pesanan", "kasir", "dapur", "kas", "antrean", "pelanggan", "laporan", "menu", "meja", "stok", "karyawan", "pengaturan"];
for (const size of ["pc", "tablet", "hp"]) {
  const { c, p } = await ctx(size);
  await login(p, "pemilik@contoh.id");
  for (const pg of pages) {
    if (size !== "pc" && !["pesanan", "kasir", "dapur", "kas", "antrean", "laporan", "menu"].includes(pg)) continue;
    await p.goto(`${BASE}/toko/${pg}`);
    await p.waitForLoadState("networkidle");
    await shot(p, `toko-${pg}-${size}`);
  }
  await c.close();
}
{
  const { c, p } = await ctx("pc", "dark");
  await login(p, "pemilik@contoh.id");
  for (const pg of ["pesanan", "laporan", "kasir", "dapur", "kas"]) {
    await p.goto(`${BASE}/toko/${pg}`);
    await p.waitForLoadState("networkidle");
    await shot(p, `toko-${pg}-pc-dark`);
  }
  await c.close();
}
// Karyawan: tidak boleh melihat laporan
{
  const { c, p } = await ctx("hp");
  await login(p, "kasir@contoh.id");
  await p.goto(`${BASE}/toko/laporan`);
  await p.waitForURL(/\/toko\/pesanan/);
  await shot(p, "staff-pesanan-hp");
  const navText = await p.locator(".bottom-nav").innerText();
  if (navText.includes("Laporan")) errors.push("Karyawan melihat menu Laporan");
  await c.close();
}
// Admin platform
{
  const { c, p } = await ctx("pc");
  await login(p, "admin@mezan.local");
  await shot(p, "admin-ringkasan-pc");
  await p.goto(`${BASE}/admin/toko`);
  await p.waitForLoadState("networkidle");
  await shot(p, "admin-toko-pc");
  await c.close();
}

await browser.close();
console.log(errors.length ? `MASALAH:\n${errors.join("\n")}` : "Tidak ada error console / overflow.");
