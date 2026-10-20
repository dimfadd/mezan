const rp = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export function rupiah(n: number | null | undefined) {
  return `Rp${rp.format(n ?? 0)}`;
}

/** Ringkas untuk sumbu grafik: 1,2 jt, 850 rb */
export function rupiahShort(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} rb`;
  return String(n);
}

export function number(n: number | null | undefined) {
  return rp.format(n ?? 0);
}

export function time(ms: number) {
  return new Date(ms).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function date(ms: number | string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  const d = typeof ms === "string" ? new Date(`${ms}T00:00:00`) : new Date(ms);
  return d.toLocaleDateString("id-ID", opts);
}

export function dateTime(ms: number) {
  return `${date(ms, { day: "numeric", month: "short" })}, ${time(ms)}`;
}

export function ago(ms: number, now = Date.now()) {
  const m = Math.floor((now - ms) / 60_000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return date(ms, { day: "numeric", month: "short" });
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export const PAY_LABEL: Record<string, string> = { cash: "Tunai", qris: "QRIS", transfer: "Transfer", card: "Kartu debit", lainnya: "Lainnya" };
export const ROLE_LABEL: Record<string, string> = { owner: "Pemilik", manager: "Manajer", staff: "Karyawan", platform_admin: "Admin Pesan.in" };
export const KIND_LABEL: Record<string, string> = { resto: "Restoran", kafe: "Kafe", warung: "Warung makan", toko: "Toko barang (baju, aksesoris, kelontong)" };
