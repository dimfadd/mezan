// Uji alur fitur di browser sungguhan: kasir offline, kartu stempel, struk WA, layar dapur,
// mode video & saran pasangan, penilaian pembeli, antrean tunggu.
// Pakai: node tests/flows.mjs <folder-output>   (API + vite jalan, database berisi data contoh)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2] ?? "flows-out";
const BASE = process.env.BASE ?? "http://localhost:5173";
mkdirSync(OUT, { recursive: true });
const errors = [];
const ok = [];
const check = (cond, msg) => (cond ? ok.push(msg) : errors.push(`GAGAL: ${msg}`));

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
async function ctx(vp = { width: 1280, height: 860 }, extra = {}) {
  const c = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: "id-ID", ...extra });
  const p = await c.newPage();
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::ERR/.test(m.text()) && errors.push(`console ${p.url()} ${m.text()}`));
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

// ---------- 1. Kasir offline ----------
{
  const { c, p } = await ctx();
  await login(p, "kasir@contoh.id");
  await p.goto(`${BASE}/toko/kasir`);
  await p.waitForSelector(".pos-item");
  await c.setOffline(true);
  await p.locator(".pos-item", { hasText: "Es Teh Manis" }).click();
  await p.locator(".pos-item", { hasText: "Tahu Crispy" }).click();
  await p.getByRole("button", { name: "Bawa pulang" }).click();
  await p.getByRole("button", { name: "Bayar sekarang" }).click();
  await p.locator("dialog[open] .btn-primary").click();
  await p.waitForSelector(".offline-box", { timeout: 5000 });
  const txt = await p.locator(".offline-box").innerText();
  check(/Offline · 1 pesanan menunggu dikirim/.test(txt), "kasir offline: pesanan tersimpan di perangkat");
  await p.locator(".offline-box").getByRole("button", { name: "Lihat" }).click();
  await p.screenshot({ path: `${OUT}/01-kasir-offline.png` });
  await c.setOffline(false);
  await p.evaluate(() => window.dispatchEvent(new Event("online")));
  await p.waitForSelector(".banner.ok", { timeout: 20000 });
  const synced = await p.locator(".banner.ok").innerText();
  check(/1 pesanan offline terkirim/.test(synced), `kasir offline: tersinkron saat online (${synced.trim()})`);
  await p.screenshot({ path: `${OUT}/02-kasir-sinkron.png` });
  const hist = await api(p, "GET", "/api/store/orders?scope=active");
  check(hist.json.orders.some((o) => o.offline === 1), "kasir offline: pesanan bertanda offline di papan");
  await c.close();
}

// ---------- 2. Kartu stempel + struk WhatsApp di kasir ----------
{
  const { c, p } = await ctx();
  await login(p, "kasir@contoh.id");
  await p.goto(`${BASE}/toko/kasir`);
  await p.waitForSelector(".pos-item");
  await p.locator(".pos-item", { hasText: "Nasi Goreng Kampung" }).click();
  const sug = await p.locator(".pair-box").count();
  check(sug > 0, "kasir: saran 'Tawarkan juga' muncul dari pasangan menu");
  await p.getByRole("button", { name: "Bawa pulang" }).click();
  await p.getByRole("button", { name: "Bayar sekarang" }).click();
  await p.fill("#pay-phone", "0812 3456 7801");
  await p.waitForSelector(".stamp-line", { timeout: 4000 });
  await p.waitForTimeout(800);
  const line = await p.locator(".loyalty-field").innerText();
  check(/10\/10/.test(line) && /Tukar hadiah/.test(line), "kasir: kartu stempel Andi terbaca dan siap tukar");
  await p.screenshot({ path: `${OUT}/03-bayar-stempel.png` });
  await p.locator(".loyalty-field .btn-accent").click();
  await p.waitForTimeout(700);
  check(/0\/10/.test(await p.locator(".loyalty-field").innerText()), "kasir: tukar hadiah mengurangi stempel");
  await p.locator("dialog[open] .modal-foot .btn-primary").click();
  await p.waitForSelector("text=Kirim struk digital ke WhatsApp");
  const href = await p.locator("a.btn-wa").getAttribute("href");
  check(href.startsWith("https://wa.me/6281234567801?text=") && decodeURIComponent(href).includes("/struk/"), "kasir: tombol WhatsApp berisi nomor & tautan struk");
  check(decodeURIComponent(href).includes("Stempel 1/10"), "kasir: pesan WA menyebut jumlah stempel");
  await p.screenshot({ path: `${OUT}/04-struk-wa.png` });
  const token = decodeURIComponent(href).match(/\/struk\/([a-f0-9]+)/)[1];
  await p.locator("dialog[open] .modal-foot .btn-primary").click();
  // Struk digital dibuka pelanggan
  const { c: c2, p: p2 } = await ctx({ width: 390, height: 844 });
  await p2.goto(`${BASE}/struk/${token}`);
  await p2.waitForSelector(".ticket");
  const body = await p2.locator("body").innerText();
  check(/Dibayar · Tunai/.test(body), "struk digital: metode bayar tampil");
  check(/1 dari 10 stempel/.test(body), "struk digital: kartu stempel tampil");
  await p2.screenshot({ path: `${OUT}/05-struk-digital-hp.png`, fullPage: true });
  await c2.close();
  await c.close();
}

// ---------- 3. Layar dapur per bagian ----------
{
  const { c, p } = await ctx();
  await login(p, "kasir@contoh.id");
  const items = (await api(p, "GET", "/api/store/items")).json.items;
  const id = (n) => items.find((i) => i.name === n).id;
  const o = await api(p, "POST", "/api/store/orders", { orderType: "takeaway", customerName: "Uji Dapur", items: [{ id: id("Mie Ayam Bakso"), qty: 2, note: "Tanpa sawi" }, { id: id("Es Jeruk Peras"), qty: 1 }] });
  check(o.status === 201, "dapur: pesanan dibuat");
  await p.goto(`${BASE}/toko/dapur`);
  await p.waitForSelector(".kds-ticket");
  await p.screenshot({ path: `${OUT}/06-dapur-semua.png` });
  await p.getByRole("button", { name: "Bar", exact: true }).click();
  const t = p.locator(".kds-ticket", { hasText: "Uji Dapur" });
  await t.waitFor();
  check((await t.innerText()).includes("Es Jeruk Peras") && !(await t.innerText()).includes("Mie Ayam"), "dapur: layar Bar hanya minuman");
  await t.locator("li button").first().click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "Dapur", exact: true }).click();
  const k = p.locator(".kds-ticket", { hasText: "Uji Dapur" });
  await k.waitFor();
  check((await k.innerText()).includes("Tanpa sawi"), "dapur: catatan tampil di tiket");
  await p.screenshot({ path: `${OUT}/07-dapur-bagian.png` });
  await k.getByRole("button", { name: /Bagian dapur selesai/ }).click();
  await p.waitForSelector("text=siap diantar");
  const st = (await api(p, "GET", "/api/store/orders?scope=active")).json.orders.find((x) => x.id === o.json.id);
  check(st.status === "ready", "dapur: semua bagian selesai → Siap diantar");
  await c.close();
}

// ---------- 4. Menu pembeli: happy hour, mode video, saran pasangan ----------
{
  const { c: co, p: po } = await ctx();
  await login(po, "pemilik@contoh.id");
  const now = await po.evaluate(() => { const d = new Date(Date.now() + 420 * 60000); return d.getUTCHours() * 60 + d.getUTCMinutes(); });
  const cats = (await api(po, "GET", "/api/store/categories")).json.categories;
  const minum = cats.find((x) => x.name === "Minuman").id;
  // Data contoh belum punya foto: pasang foto buatan di 3 menu supaya mode video punya isi.
  await po.evaluate(async () => {
    const items = (await (await fetch("/api/store/items")).json()).items;
    const colors = ["#c4813f", "#e7b73d", "#7a4a2a"];
    for (const [k, name] of ["Nasi Goreng Kampung", "Soto Ayam Lamongan", "Kopi Susu Gula Aren"].entries()) {
      const it = items.find((i) => i.name === name);
      if (it.media.length) continue;
      const cv = Object.assign(document.createElement("canvas"), { width: 480, height: 640 });
      const g = cv.getContext("2d");
      g.fillStyle = colors[k]; g.fillRect(0, 0, 480, 640);
      g.fillStyle = "#fff"; g.font = "bold 40px sans-serif"; g.fillText(name, 30, 320);
      const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.8));
      const fd = new FormData(); fd.append("file", new File([blob], "a.jpg", { type: "image/jpeg" }));
      const up = await (await fetch("/api/store/media", { method: "POST", body: fd })).json();
      const body = { ...it, media: [{ kind: "image", url: up.url }], pair_ids: it.pair_ids ? it.pair_ids.split(",") : [] };
      await fetch(`/api/store/items/${it.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    }
  });
  const rule = await api(po, "POST", "/api/store/price-rules", { name: "Uji promo", percent: 25, days: 127, start_min: (now + 1430) % 1440, end_min: (now + 30) % 1440, category_ids: [minum] });
  check(rule.status === 201, "promo: aturan uji dibuat");

  const { c, p } = await ctx({ width: 390, height: 844 }, { hasTouch: true, isMobile: true });
  await p.goto(`${BASE}/m/contoh-meja1`);
  await p.waitForSelector(".dish");
  const kopi = p.locator(".dish", { hasText: "Kopi Susu Gula Aren" });
  const kt = await kopi.innerText();
  check(/Rp15\.000/.test(kt) && /Rp11\.300|Rp11\.200/.test(kt) && /Uji promo/.test(kt), `promo: harga coret + harga promo di menu (${kt.replace(/\n/g, " ").slice(0, 80)})`);
  await kopi.scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}/08-menu-promo-hp.png` });
  const bubur = await p.locator(".dish", { hasText: "Bubur Ayam" }).innerText();
  const pagi = now >= 360 && now < 600;
  check(pagi ? !/Tersedia 06/.test(bubur) : /Tersedia 06\.00–10\.00/.test(bubur), "jadwal: bubur pagi ditandai sesuai jam");

  await p.locator(".dish", { hasText: "Nasi Goreng Kampung" }).click();
  await p.waitForSelector("dialog[open]");
  const pairs = await p.locator("dialog[open] .pair-chip").count();
  check(pairs > 0, `pasangan: detail menu menampilkan ${pairs} saran`);
  await p.locator("dialog[open]").screenshot({ path: `${OUT}/09-detail-pasangan.png` });
  if (pairs) await p.locator("dialog[open] .pair-chip").first().click();
  await p.waitForTimeout(300);
  await p.locator("dialog[open] .btn-primary.btn-lg").click();
  await p.waitForSelector(".cartbar");
  const bar = await p.locator(".cartbar").innerText();
  check(Number(/(\d+) item/.exec(bar)?.[1] ?? 0) >= 2, `pasangan: saran ikut masuk keranjang (${bar.split("\n")[0]})`);

  await p.getByRole("button", { name: "Video" }).click();
  await p.waitForSelector(".vf-slide");
  const slides = await p.locator(".vf-slide").count();
  check(slides >= 3, `mode video: ${slides} menu bergeser vertikal`);
  await p.screenshot({ path: `${OUT}/10-mode-video.png` });
  await p.locator(".vf").evaluate((el) => el.scrollBy(0, el.clientHeight));
  await p.waitForTimeout(700);
  check((await p.locator(".vf-count").innerText()).startsWith("2/"), "mode video: penghitung ikut bergeser");
  await p.locator(".vf-slide").nth(1).getByRole("button", { name: /Tambah/ }).click().catch(() => {});
  await p.keyboard.press("Escape");
  await p.waitForSelector(".vf", { state: "detached" });
  check(true, "mode video: Escape menutup");
  await api(po, "DELETE", `/api/store/price-rules/${rule.json.id}`);
  await c.close();
  await co.close();
}

// ---------- 5. Penilaian & stempel pembeli QR ----------
{
  const { c, p } = await ctx({ width: 390, height: 844 });
  await p.goto(`${BASE}/m/contoh-meja1`);
  await p.waitForSelector(".dish");
  await p.locator(".dish", { hasText: "Ayam Geprek" }).click();
  await p.locator("dialog[open] .btn-primary.btn-lg").click();
  await p.locator(".cartbar").click();
  await p.fill("#c-name", "Uji Nilai");
  await p.locator("dialog[open] .modal-foot .btn-primary").click();
  await p.waitForURL(/pesanan/);
  const token = p.url().split("/").pop();
  const { c: ck, p: pk } = await ctx();
  await login(pk, "kasir@contoh.id");
  const o = (await api(pk, "GET", "/api/store/orders?scope=active")).json.orders.find((x) => x.customer_name === "Uji Nilai");
  for (const s of ["preparing", "ready", "done"]) await api(pk, "PATCH", `/api/store/orders/${o.id}/status`, { status: s });
  await api(pk, "PATCH", `/api/store/orders/${o.id}/pay`, { method: "qris", amountReceived: null });
  await p.reload();
  await p.waitForSelector(".stars");
  await p.locator(".stars button").nth(4).click();
  await p.locator(".rate-item .thumb").first().click();
  await p.fill("#rate-c", "Pedasnya mantap");
  await p.screenshot({ path: `${OUT}/11-nilai-hp.png`, fullPage: true });
  await p.getByRole("button", { name: "Kirim penilaian" }).click();
  await p.waitForSelector("text=Terima kasih, penilaianmu sudah diterima.");
  check(true, "penilaian: terkirim dari HP pembeli");
  await p.fill("#st-phone", `0857${String(Date.now()).slice(-8)}`);
  await p.getByRole("button", { name: "Ambil stempel" }).click();
  await p.waitForSelector(".stamp-card i.on");
  check(/1 dari 10 stempel/.test(await p.locator("body").innerText()), "stempel: pembeli QR mengambil stempel sendiri");
  await p.screenshot({ path: `${OUT}/12-stempel-hp.png`, fullPage: true });
  check((await api(pk, "GET", "/api/store/analytics?range=today")).status === 403, "penilaian: laporan tidak bisa dibuka kasir");
  const { c: co, p: po } = await ctx();
  await login(po, "pemilik@contoh.id");
  const rep = await api(po, "GET", "/api/store/analytics?range=today");
  check(rep.json.feedback.recent.some((x) => x.comment === "Pedasnya mantap"), "penilaian: masuk laporan pemilik");
  await co.close();
  await ck.close();
  await c.close();
}

// ---------- 6. Antrean tunggu ----------
{
  const { c: cg, p: pg } = await ctx({ width: 390, height: 844 });
  await pg.goto(`${BASE}/antre/contoh-antre`);
  await pg.waitForSelector("#w-name");
  await pg.fill("#w-name", "Rombongan Uji");
  await pg.locator('button[aria-label="Tambah"], button[aria-label="More"]').first().click();
  await pg.locator("form .btn-primary").click();
  await pg.waitForSelector(".wait-no");
  const no = await pg.locator(".wait-no").innerText();
  check(/^A\d+$/.test(no.trim()), `antrean: tamu dapat nomor ${no.trim()}`);
  check(/rombongan di depanmu|parties ahead|party ahead/.test(await pg.locator(".wait-card").innerText()), "antrean: posisi tampil");
  await pg.screenshot({ path: `${OUT}/13-antre-tunggu-hp.png` });

  const { c, p } = await ctx();
  await login(p, "kasir@contoh.id");
  await p.goto(`${BASE}/toko/antrean`);
  const row = p.locator(".wl-row", { hasText: "Rombongan Uji" });
  await row.waitFor();
  await row.getByRole("button", { name: "Panggil" }).click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/14-antrean-kasir.png` });
  await pg.waitForSelector(".wait-page.is-called", { timeout: 15000 });
  check(true, "antrean: HP tamu berubah jadi 'Mejamu siap' setelah dipanggil");
  await pg.screenshot({ path: `${OUT}/15-antre-dipanggil-hp.png` });
  await p.locator(".wl-row", { hasText: "Rombongan Uji" }).getByRole("button", { name: "Duduk" }).click();
  await p.locator("dialog[open] .chip").first().click();
  await p.waitForSelector("text=Selesai hari ini");
  check((await p.locator("table").last().innerText()).includes("Rombongan Uji"), "antrean: tamu didudukkan & pindah ke Selesai");
  await c.close();
  await cg.close();
}

await browser.close();
console.log(ok.map((m) => `OK  ${m}`).join("\n"));
console.log(errors.length ? `\nMASALAH:\n${errors.join("\n")}` : "\nSemua alur lolos.");
