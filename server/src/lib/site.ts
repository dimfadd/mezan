import { z } from "zod";
import type { DB } from "../db/types";
import { all } from "../db/types";
import { FEATURE_KEYS, SOLUTION_ICONS, mergeSite, type Site, type SiteKey } from "../../../shared/site";

// Tautan yang boleh dipasang admin: jalur di situs ini, bagian halaman, https, atau mailto.
// Menolak javascript: dan sejenisnya supaya tautan tidak bisa dipakai menjalankan skrip.
const href = z
  .string()
  .trim()
  .max(300)
  .regex(/^(\/[^\s]*|#[\w-]*|https:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+)$/, "Tautan harus diawali /, #, https://, atau mailto:.");
const text = (max: number) => z.string().trim().max(max);
const link = z.object({ label: text(60).min(1, "Label tautan wajib diisi."), href, desc: text(120).optional() });

export const siteSchemas = {
  nav: z
    .array(
      z.object({
        label: text(30).min(1, "Nama menu wajib diisi."),
        href: href.optional().or(z.literal("").transform(() => undefined)),
        auto: z.literal("solutions").optional(),
        sections: z.array(z.object({ title: text(40), items: z.array(link).max(12) })).max(3),
      }),
    )
    .max(7),
  solutions: z
    .array(
      z.object({
        slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Alamat halaman hanya huruf kecil, angka, dan tanda hubung.").max(40),
        name: text(40).min(2),
        icon: z.enum(SOLUTION_ICONS),
        headline: text(120).min(5),
        intro: text(400),
        points: z.array(text(160).min(1)).max(6),
        features: z.array(z.enum(FEATURE_KEYS as [string, ...string[]])).max(9),
        published: z.boolean(),
      }),
    )
    .max(12)
    .refine((l) => new Set(l.map((s) => s.slug)).size === l.length, "Alamat halaman solusi tidak boleh sama."),
  testimonials: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        quote: text(400).min(10, "Kutipan terlalu pendek."),
        name: text(60).min(2),
        role: text(40),
        business: text(60).min(2),
        city: text(40),
        photo_url: z.string().trim().max(300).regex(/^(|\/media\/[^\s]+|https:\/\/[^\s]+)$/, "Foto harus tautan https atau unggahan."),
        consent: z.boolean().default(false),
        published: z.boolean(),
      }),
    )
    .max(24)
    // Testimoni hanya boleh tampil kalau ada izin dari orangnya (UU PDP, UU Perlindungan Konsumen).
    .refine((l) => l.every((t) => !t.published || t.consent), "Testimoni yang terbit harus punya izin tertulis dari orangnya."),
  footer: z.object({
    tagline: text(200),
    columns: z.array(z.object({ title: text(40).min(1), auto: z.literal("solutions").optional(), links: z.array(link).max(10) })).max(4),
    contact: z.object({
      email: z.string().trim().max(120).regex(/^(|[^\s@]+@[^\s@]+\.[^\s@]+)$/, "Email belum benar."),
      whatsapp: z.string().trim().max(20).regex(/^[\d +()-]*$/, "Nomor WhatsApp hanya angka."),
      address: text(200),
      hours: text(80),
    }),
  }),
} satisfies Record<SiteKey, z.ZodTypeAny>;

// Dibaca setiap kunjungan landing; disimpan sebentar di memori.
let cache: { at: number; site: Site } | null = null;
const TTL = 30_000;

export async function loadSite(db: DB, fresh = false): Promise<Site> {
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache.site;
  const rows = await all<{ key: SiteKey; value: string }>(db, "SELECT key, value FROM site_content");
  const stored: Partial<Site> = {};
  for (const r of rows) {
    try {
      (stored as Record<string, unknown>)[r.key] = JSON.parse(r.value);
    } catch {
      // isi rusak: abaikan, pakai bawaan
    }
  }
  const site = mergeSite(stored);
  cache = { at: Date.now(), site };
  return site;
}

export function forgetSite() {
  cache = null;
}
