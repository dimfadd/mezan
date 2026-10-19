// Semua fungsi kripto memakai Web Crypto, jadi jalan di Node 20+ dan Cloudflare Workers.
const enc = new TextEncoder();
const ITERATIONS = 100_000; // batas atas PBKDF2 di Cloudflare Workers

function toHex(buf: ArrayBuffer | Uint8Array) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function randomToken(bytes = 24) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return toHex(b);
}

// Kode pendek tanpa huruf yang mirip (0/O, 1/l/I) untuk QR meja.
export function randomCode(len = 8) {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  const b = crypto.getRandomValues(new Uint8Array(len));
  return [...b].map((x) => alphabet[x % alphabet.length]).join("");
}

export function newId() {
  return crypto.randomUUID();
}

export async function sha256(text: string) {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return toHex(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${await pbkdf2(password, salt, ITERATIONS)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, iter, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iter || !salt || !hash) return false;
  const actual = await pbkdf2(password, fromHex(salt), Number(iter));
  // perbandingan waktu-konstan
  if (actual.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}
