import { all, stmt, type DB, type Stmt } from "../db/types";
import type { Tenant } from "./auth";
import { fail } from "./http";
import { newId } from "./security";

export interface MediaRef {
  kind: "image" | "video";
  url: string;
}

/** Galeri semua menu toko, dikelompokkan per menu dan sudah terurut (indeks 0 = sampul). */
export async function loadGalleries(db: DB, tenantId: string) {
  const rows = await all<{ menu_item_id: string; kind: "image" | "video"; url: string }>(
    db,
    "SELECT menu_item_id, kind, url FROM menu_media WHERE tenant_id = ? ORDER BY menu_item_id, sort",
    tenantId,
  );
  const map = new Map<string, MediaRef[]>();
  for (const r of rows) {
    const list = map.get(r.menu_item_id) ?? [];
    list.push({ kind: r.kind, url: r.url });
    map.set(r.menu_item_id, list);
  }
  return map;
}

/** Batas galeri sesuai paket. Video hanya kalau paket mengizinkan video. */
export function galleryLimits(t: Tenant) {
  return { photos: t.max_photos, videos: t.allow_video ? t.max_videos : 0 };
}

export function checkGallery(t: Tenant, media: MediaRef[]) {
  const lim = galleryLimits(t);
  const photos = media.filter((m) => m.kind === "image").length;
  const videos = media.filter((m) => m.kind === "video").length;
  if (photos > lim.photos) fail(403, `Paket ${t.plan_name} maksimal ${lim.photos} foto per menu.`);
  if (videos > lim.videos) fail(403, lim.videos ? `Paket ${t.plan_name} maksimal ${lim.videos} video per menu.` : `Video menu belum termasuk di paket ${t.plan_name}.`);
  const urls = new Set(media.map((m) => m.url));
  if (urls.size !== media.length) fail(400, "Ada file yang sama dimasukkan dua kali.");
}

/** Pernyataan untuk mengganti seluruh galeri satu menu (dipakai dalam batch). */
export function replaceGallery(db: DB, tenantId: string, itemId: string, media: MediaRef[]): Stmt[] {
  const now = Date.now();
  return [
    stmt(db, "DELETE FROM menu_media WHERE menu_item_id = ? AND tenant_id = ?", itemId, tenantId),
    ...media.map((m, i) =>
      stmt(db, "INSERT INTO menu_media (id, tenant_id, menu_item_id, kind, url, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", newId(), tenantId, itemId, m.kind, m.url, i, now),
    ),
  ];
}

/** Sampul untuk daftar menu & kasir: foto pertama, dan video pertama sebagai cadangan. */
export function coverOf(media: MediaRef[]) {
  return {
    image_url: media.find((m) => m.kind === "image")?.url ?? null,
    video_url: media.find((m) => m.kind === "video")?.url ?? null,
  };
}
