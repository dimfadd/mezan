// Varian produk & barcode, dipakai server dan aplikasi.

export interface Variant {
  id: string;
  opt1: string;
  opt2: string;
  price: number | null; // kosong = harga produk
  cost?: number | null;
  sku: string;
  barcode: string;
  stock_qty: number;
  available: number | boolean;
}

/** "Hitam / L" */
export function variantLabel(v: { opt1: string; opt2: string }) {
  return [v.opt1, v.opt2].filter(Boolean).join(" / ");
}

/** "Kaos Polos (Hitam / L)" */
export function lineName(name: string, variant?: string | null) {
  return variant ? `${name} (${variant})` : name;
}

export function variantPrice(itemPrice: number, v: { price: number | null } | null | undefined) {
  return v && v.price != null ? v.price : itemPrice;
}

/** Rentang harga untuk tampilan: "Rp75.000" atau "mulai Rp75.000". */
export function priceRange(itemPrice: number, variants: { price: number | null; available?: number | boolean }[]) {
  const ps = variants.filter((v) => v.available !== 0 && v.available !== false).map((v) => variantPrice(itemPrice, v));
  if (!ps.length) return { min: itemPrice, max: itemPrice };
  return { min: Math.min(...ps), max: Math.max(...ps) };
}

export function normalizeBarcode(code: string) {
  return code.replace(/\s+/g, "").slice(0, 64);
}

function ean13Check(d12: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d12[i]) * (i % 2 ? 3 : 1);
  return String((10 - (sum % 10)) % 10);
}

export function isEan13(code: string) {
  return /^\d{13}$/.test(code) && ean13Check(code.slice(0, 12)) === code[12];
}

/**
 * Kode EAN-13 untuk barang tanpa barcode pabrik. Diawali 2 (rentang "pemakaian di dalam toko"
 * menurut GS1), jadi tidak bentrok dengan barcode produk pabrik.
 */
export function newStoreBarcode() {
  let d = "2";
  const rnd = new Uint32Array(3);
  crypto.getRandomValues(rnd);
  const digits = rnd.reduce((s, n) => s + String(n).padStart(10, "0"), "");
  d += digits.slice(0, 11);
  return d + ean13Check(d);
}
