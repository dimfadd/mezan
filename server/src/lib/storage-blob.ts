// Penyimpanan media di Vercel Blob. Kunci file sama dengan versi lokal (<tenant>/<uuid>.<ext>),
// jadi URL /media/... di database tidak berubah saat pindah penyimpanan.
import { del, head, put } from "@vercel/blob";
import type { MediaStorage } from "./storage";

export function blobStorage(token: string): MediaStorage {
  return {
    async put(key, data, contentType) {
      await put(`media/${key}`, Buffer.from(data), { access: "public", addRandomSuffix: false, contentType, token, allowOverwrite: true });
    },
    async get() {
      return null; // tidak dipakai: publicUrl selalu tersedia
    },
    async delete(key) {
      await del(`media/${key}`, { token }).catch(() => {});
    },
    async publicUrl(key) {
      try {
        return (await head(`media/${key}`, { token })).url;
      } catch {
        return null;
      }
    },
  };
}
