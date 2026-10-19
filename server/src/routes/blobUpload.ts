// Unggah langsung dari browser ke Vercel Blob. Server hanya memberi izin (token) setelah memeriksa
// login, paket, jenis file, dan nama file. Isi file tidak lewat fungsi Vercel (yang dibatasi ~4,5 MB).
import { Hono } from "hono";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { Env } from "../app";
import { MANAGEMENT } from "../lib/auth";
import { fail } from "../lib/http";
import { galleryLimits } from "../lib/gallery";
import { MEDIA_LIMITS } from "../lib/storage";

const TYPE_BY_EXT: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm" };

export const blobUploadRoutes = new Hono<Env>();

blobUploadRoutes.post("/", async (c) => {
  const token = c.var.blobToken;
  if (!token) fail(404, "Unggah langsung tidak aktif di server ini.");
  const body = (await c.req.json()) as HandleUploadBody;

  // Permintaan izin unggah selalu dari browser pengguna yang login.
  if (body.type === "blob.generate-client-token") {
    const u = c.var.user;
    const t = c.var.tenant;
    if (!u || !t) fail(401, "Sesi kamu habis. Silakan masuk lagi.");
    if (!MANAGEMENT.includes(u.role)) fail(403, "Bagian ini hanya untuk manajemen toko.");
  }

  let result;
  try {
    result = await handleUpload({
    token,
    request: c.req.raw,
    body,
    onBeforeGenerateToken: async (pathname) => {
      const t = c.var.tenant!;
      const m = new RegExp(`^media/${t.id}/[0-9a-f-]{36}\\.(jpg|png|webp|gif|mp4|webm)$`).exec(pathname);
      if (!m) throw new Error("Nama file tidak valid.");
      const type = TYPE_BY_EXT[m[1]];
      const kind = type.startsWith("video/") ? "video" : "image";
      if (kind === "video" && galleryLimits(t).videos === 0) throw new Error(`Video menu belum termasuk di paket ${t.plan_name}.`);
      return {
        allowedContentTypes: [type],
        maximumSizeInBytes: MEDIA_LIMITS[kind].maxBytes,
        addRandomSuffix: false,
        allowOverwrite: false,
      };
    },
    });
  } catch (e) {
    fail(400, (e as Error).message || "Unggahan ditolak.");
  }
  return c.json(result);
});
