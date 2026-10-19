// Tema tampilan menu pelanggan. Dipakai bersama oleh server (validasi) dan web (penerapan + pratinjau).
// Paket biasa (UMKM) selalu memakai DEFAULT_THEME. Paket dengan allow_branding boleh mengubahnya.

export type Radius = "tajam" | "sedang" | "bulat";
export type Layout = "list" | "grid";

export interface MenuTheme {
  bg: string; // latar halaman
  surface: string; // kartu menu
  ink: string; // warna teks
  brand: string; // tombol utama & harga
  accent: string; // tombol keranjang
  headingFont: string;
  bodyFont: string;
  radius: Radius;
  layout: Layout;
  bgImage: string | null;
  logo: string | null;
}

export interface FontOption {
  id: string;
  label: string;
  family: string; // nilai CSS font-family
  google: string | null; // parameter family= untuk Google Fonts, null kalau sudah dibundel
  note: string;
}

// Daftar font dikurasi: semua punya huruf latin lengkap, enak dibaca di HP, dan cocok untuk menu.
export const HEADING_FONTS: FontOption[] = [
  { id: "fredoka", label: "Fredoka", family: '"Fredoka Variable", "Fredoka", system-ui, sans-serif', google: null, note: "Membulat dan ramah, font khas Pesan.in (bawaan)" },
  { id: "fraunces", label: "Fraunces", family: '"Fraunces", Georgia, serif', google: null, note: "Serif hangat, rasa menu cetak" },
  { id: "playfair", label: "Playfair Display", family: '"Playfair Display", Georgia, serif', google: "Playfair+Display:wght@600;700", note: "Elegan, cocok fine dining" },
  { id: "dmserif", label: "DM Serif Display", family: '"DM Serif Display", Georgia, serif', google: "DM+Serif+Display", note: "Tegas dan klasik" },
  { id: "bricolage", label: "Bricolage Grotesque", family: '"Bricolage Grotesque", system-ui, sans-serif', google: "Bricolage+Grotesque:wght@600;700", note: "Modern dan berkarakter, cocok kafe" },
  { id: "spacegrotesk", label: "Space Grotesk", family: '"Space Grotesk", system-ui, sans-serif', google: "Space+Grotesk:wght@600;700", note: "Geometris, kesan urban" },
  { id: "jakarta", label: "Plus Jakarta Sans", family: '"Plus Jakarta Sans Variable", system-ui, sans-serif', google: null, note: "Bersih, sama dengan isi teks" },
  { id: "caveat", label: "Caveat", family: '"Caveat", cursive', google: "Caveat:wght@600;700", note: "Tulisan tangan, rasa papan kapur" },
];

export const BODY_FONTS: FontOption[] = [
  { id: "fredoka", label: "Fredoka", family: '"Fredoka Variable", "Fredoka", system-ui, sans-serif', google: null, note: "Font khas Pesan.in (bawaan)" },
  { id: "jakarta", label: "Plus Jakarta Sans", family: '"Plus Jakarta Sans Variable", system-ui, sans-serif', google: null, note: "Paling tegas untuk teks kecil" },
  { id: "dmsans", label: "DM Sans", family: '"DM Sans", system-ui, sans-serif', google: "DM+Sans:wght@400;600;700", note: "Ramping dan rapi" },
  { id: "nunito", label: "Nunito", family: '"Nunito", system-ui, sans-serif', google: "Nunito:wght@400;600;700;800", note: "Membulat, ramah" },
  { id: "worksans", label: "Work Sans", family: '"Work Sans", system-ui, sans-serif', google: "Work+Sans:wght@400;600;700", note: "Netral, cocok resto besar" },
  { id: "lora", label: "Lora", family: '"Lora", Georgia, serif', google: "Lora:wght@400;600;700", note: "Serif untuk teks, kesan klasik" },
];

export const DEFAULT_THEME: MenuTheme = {
  bg: "#f7f4ee",
  surface: "#ffffff",
  ink: "#1e1b16",
  brand: "#1f6b4f",
  accent: "#e8a317",
  headingFont: "fredoka",
  bodyFont: "fredoka",
  radius: "sedang",
  layout: "list",
  bgImage: null,
  logo: null,
};

// Titik awal untuk pemilik yang tidak mau mulai dari nol. Semua sudah lolos cek kontras.
export const PRESETS: { id: string; label: string; theme: Partial<MenuTheme> }[] = [
  { id: "kertas", label: "Kertas warung", theme: {} },
  { id: "kopi", label: "Kopi susu", theme: { bg: "#efe6da", surface: "#fbf7f1", ink: "#2b1d14", brand: "#6b3e26", accent: "#d9a45b", headingFont: "bricolage", bodyFont: "dmsans", radius: "bulat" } },
  { id: "malam", label: "Malam", theme: { bg: "#121212", surface: "#1d1d1d", ink: "#f2efe9", brand: "#e9c46a", accent: "#e76f51", headingFont: "playfair", bodyFont: "worksans", radius: "tajam" } },
  { id: "laut", label: "Laut", theme: { bg: "#e8f1f2", surface: "#ffffff", ink: "#0f2a33", brand: "#0b6e78", accent: "#f4a259", headingFont: "dmserif", bodyFont: "nunito", radius: "sedang" } },
  { id: "bata", label: "Bata", theme: { bg: "#f6ece4", surface: "#fffaf6", ink: "#2a1410", brand: "#a63d2a", accent: "#2f6d57", headingFont: "spacegrotesk", bodyFont: "worksans", radius: "tajam", layout: "grid" } },
];

const HEX = /^#[0-9a-f]{6}$/i;

export function normalizeTheme(raw: unknown): MenuTheme {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<MenuTheme>;
  const pick = <K extends keyof MenuTheme>(k: K, ok: (v: unknown) => boolean) => (ok(r[k]) ? (r[k] as MenuTheme[K]) : DEFAULT_THEME[k]);
  const isHex = (v: unknown) => typeof v === "string" && HEX.test(v);
  return {
    bg: pick("bg", isHex).toLowerCase(),
    surface: pick("surface", isHex).toLowerCase(),
    ink: pick("ink", isHex).toLowerCase(),
    brand: pick("brand", isHex).toLowerCase(),
    accent: pick("accent", isHex).toLowerCase(),
    headingFont: pick("headingFont", (v) => HEADING_FONTS.some((f) => f.id === v)),
    bodyFont: pick("bodyFont", (v) => BODY_FONTS.some((f) => f.id === v)),
    radius: pick("radius", (v) => v === "tajam" || v === "sedang" || v === "bulat"),
    layout: pick("layout", (v) => v === "list" || v === "grid"),
    bgImage: typeof r.bgImage === "string" ? r.bgImage : null,
    logo: typeof r.logo === "string" ? r.logo : null,
  };
}

// ---------- Kontras (WCAG 2.x) ----------
function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Warna teks paling terbaca di atas warna tertentu (hitam hangat atau putih). */
export function readableOn(hex: string) {
  return contrast(hex, "#ffffff") >= contrast(hex, "#1e1b16") ? "#ffffff" : "#1e1b16";
}

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export interface ThemeIssue {
  field: keyof MenuTheme;
  message: string;
}

/** Tolak kombinasi warna yang membuat menu sulit dibaca (minimal WCAG AA 4.5:1 untuk teks). */
export function checkTheme(t: MenuTheme): ThemeIssue[] {
  const issues: ThemeIssue[] = [];
  const r = (n: number) => n.toFixed(1).replace(".", ",");
  const c1 = contrast(t.ink, t.surface);
  if (c1 < 4.5) issues.push({ field: "ink", message: `Teks di kartu menu kurang terbaca (kontras ${r(c1)}, minimal 4,5). Gelapkan/terangkan warna teks atau kartu.` });
  if (!t.bgImage) {
    const c2 = contrast(t.ink, t.bg);
    if (c2 < 4.5) issues.push({ field: "bg", message: `Nama toko di atas latar kurang terbaca (kontras ${r(c2)}, minimal 4,5).` });
  }
  const c3 = contrast(t.brand, readableOn(t.brand));
  if (c3 < 4.5) issues.push({ field: "brand", message: `Tulisan di tombol utama kurang terbaca (kontras ${r(c3)}). Pilih warna utama yang lebih gelap atau lebih terang.` });
  const c4 = contrast(t.accent, readableOn(t.accent));
  if (c4 < 4.5) issues.push({ field: "accent", message: `Tulisan di tombol keranjang kurang terbaca (kontras ${r(c4)}). Pilih warna yang lebih gelap atau lebih terang.` });
  return issues;
}

const RADIUS: Record<Radius, [string, string, string]> = { tajam: ["2px", "4px", "6px"], sedang: ["6px", "10px", "16px"], bulat: ["10px", "16px", "24px"] };

/** Variabel CSS yang menimpa token bawaan di halaman menu pelanggan. */
export function themeVars(t: MenuTheme): Record<string, string> {
  const dark = lum(t.bg) < 0.2;
  const heading = HEADING_FONTS.find((f) => f.id === t.headingFont) ?? HEADING_FONTS[0];
  const body = BODY_FONTS.find((f) => f.id === t.bodyFont) ?? BODY_FONTS[0];
  const [sm, md, lg] = RADIUS[t.radius];
  const brandText = contrast(t.brand, t.surface) >= 4.5 ? t.brand : t.ink;
  return {
    "--paper": t.bg,
    "--surface": t.surface,
    "--surface-2": mix(t.surface, t.ink, 0.07),
    "--ink": t.ink,
    "--ink-2": mix(t.ink, t.surface, 0.3),
    "--ink-3": mix(t.ink, t.surface, 0.42),
    "--line": mix(t.surface, t.ink, 0.13),
    "--line-strong": mix(t.surface, t.ink, 0.24),
    "--brand": t.brand,
    "--brand-hover": mix(t.brand, dark ? "#ffffff" : "#000000", 0.12),
    "--brand-ink": readableOn(t.brand),
    "--brand-soft": mix(t.surface, t.brand, 0.12),
    "--brand-text": brandText,
    "--accent": t.accent,
    "--accent-ink": readableOn(t.accent),
    "--focus": brandText,
    "--font-menu": heading.family,
    "--font": body.family,
    "--radius-sm": sm,
    "--radius": md,
    "--radius-lg": lg,
    "color-scheme": dark ? "dark" : "light",
  };
}

export function fontHref(t: MenuTheme) {
  const fams = [HEADING_FONTS.find((f) => f.id === t.headingFont)?.google, BODY_FONTS.find((f) => f.id === t.bodyFont)?.google].filter(Boolean);
  if (!fams.length) return null;
  return `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f}`).join("&")}&display=swap`;
}
