// Identitas pengelola untuk halaman hukum dan footer.
// Isi lewat variabel lingkungan saat build (Vercel/VPS), supaya tidak perlu mengubah kode:
//   VITE_LEGAL_OPERATOR  nama pengelola atau badan usaha, mis. "PT Contoh Digital Indonesia"
//   VITE_LEGAL_EMAIL     email resmi untuk pertanyaan hukum & privasi
//   VITE_LEGAL_CITY      kota domisili hukum, mis. "Jakarta Selatan"
export const BRAND = "Pesan.in";
export const LEGAL = {
  operator: (import.meta.env.VITE_LEGAL_OPERATOR as string | undefined)?.trim() || "Pengelola Pesan.in",
  email: (import.meta.env.VITE_LEGAL_EMAIL as string | undefined)?.trim() || "",
  city: (import.meta.env.VITE_LEGAL_CITY as string | undefined)?.trim() || "",
  updated: "19 Oktober 2026",
  since: 2026,
};

export function copyrightYears(now = new Date()) {
  const y = now.getFullYear();
  return y > LEGAL.since ? `${LEGAL.since}–${y}` : String(LEGAL.since);
}
