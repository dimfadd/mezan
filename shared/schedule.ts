// Jadwal menu (menu sarapan, menu malam) dan promo jam tertentu (happy hour).
// Dipakai server saat menghitung harga pesanan dan browser saat menampilkan menu, supaya hasilnya sama.

export const ALL_DAYS = 127; // bit 0 = Minggu ... bit 6 = Sabtu

export interface Clock {
  day: number; // 0 = Minggu
  min: number; // menit sejak 00:00 waktu toko
}

export interface Schedulable {
  avail_days?: number | null;
  avail_from?: number | null;
  avail_to?: number | null;
}

export interface PriceRule {
  id: string;
  name: string;
  percent: number;
  days: number;
  start_min: number;
  end_min: number;
  category_ids: string; // kosong = semua menu
  active: number;
}

/** Jam dan hari menurut zona waktu toko (bukan zona waktu HP/server). */
export function clockAt(ts: number, tzOffsetMinutes: number): Clock {
  const d = new Date(ts + tzOffsetMinutes * 60_000);
  return { day: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

const dayOn = (days: number, d: number) => ((days >> d) & 1) === 1;

/** Apakah jam sekarang masuk rentang. Rentang yang melewati tengah malam (mis. 22.00 sampai 02.00) ikut hari mulainya. */
export function inWindow(days: number, from: number | null | undefined, to: number | null | undefined, c: Clock) {
  if (from == null || to == null || from === to) return dayOn(days, c.day);
  if (from < to) return dayOn(days, c.day) && c.min >= from && c.min < to;
  return (dayOn(days, c.day) && c.min >= from) || (dayOn(days, (c.day + 6) % 7) && c.min < to);
}

export function availableAt(item: Schedulable, c: Clock) {
  return inWindow(item.avail_days ?? ALL_DAYS, item.avail_from, item.avail_to, c);
}

export function hasSchedule(item: Schedulable) {
  return (item.avail_days ?? ALL_DAYS) !== ALL_DAYS || (item.avail_from != null && item.avail_to != null && item.avail_from !== item.avail_to);
}

/** Promo yang berlaku untuk satu menu saat ini. Kalau beberapa berlaku sekaligus, ambil diskon terbesar (tidak ditumpuk). */
export function ruleFor(rules: PriceRule[], categoryId: string | null | undefined, c: Clock) {
  let best: PriceRule | null = null;
  for (const r of rules) {
    if (!r.active) continue;
    const cats = r.category_ids ? r.category_ids.split(",") : [];
    if (cats.length && (!categoryId || !cats.includes(categoryId))) continue;
    if (!inWindow(r.days, r.start_min, r.end_min, c)) continue;
    if (!best || r.percent > best.percent) best = r;
  }
  return best;
}

/** Harga setelah diskon, dibulatkan ke ratusan rupiah supaya tidak muncul angka seperti Rp12.347. */
export function discounted(price: number, percent: number) {
  const raw = (price * (100 - percent)) / 100;
  return price >= 1000 ? Math.round(raw / 100) * 100 : Math.round(raw);
}

export function priceInfo(item: { price: number; category_id: string | null }, rules: PriceRule[], c: Clock) {
  const r = ruleFor(rules, item.category_id, c);
  return r ? { price: discounted(item.price, r.percent), list: item.price, promo: r.name, percent: r.percent } : { price: item.price, list: item.price, promo: null, percent: 0 };
}

export const fmtMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}.${String(m % 60).padStart(2, "0")}`;

export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2})[.:](\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

const DAY_SHORT = { id: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };

/** Mis. "Sen–Jum" atau "Sab, Min". Kosong kalau setiap hari. */
export function daysText(days: number, lang: "id" | "en" = "id") {
  if (days === ALL_DAYS) return "";
  const names = DAY_SHORT[lang];
  const order = [1, 2, 3, 4, 5, 6, 0]; // mulai Senin
  const on = order.filter((d) => dayOn(days, d));
  if (on.length === 0) return lang === "en" ? "never" : "tidak pernah";
  // Rentang berurutan ditulis "Sen–Jum".
  const idx = on.map((d) => order.indexOf(d));
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (contiguous && on.length >= 3) return `${names[on[0]]}–${names[on[on.length - 1]]}`;
  return on.map((d) => names[d]).join(", ");
}

/** Mis. "06.00–10.00" atau "Sab, Min · 17.00–22.00". */
export function scheduleText(item: Schedulable, lang: "id" | "en" = "id") {
  const days = daysText(item.avail_days ?? ALL_DAYS, lang);
  const hours = item.avail_from != null && item.avail_to != null && item.avail_from !== item.avail_to ? `${fmtMin(item.avail_from)}–${fmtMin(item.avail_to)}` : "";
  return [days, hours].filter(Boolean).join(" · ");
}
