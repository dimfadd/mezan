// Penyimpanan file media. Lokal: folder di disk. Produksi: Cloudflare R2 (lihat worker.ts).
export interface MediaStorage {
  put(key: string, data: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream | ArrayBuffer | Uint8Array; contentType: string; size: number } | null>;
  delete(key: string): Promise<void>;
}

export const MEDIA_LIMITS = {
  image: { maxBytes: 3 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
  video: { maxBytes: 15 * 1024 * 1024, types: ["video/mp4", "video/webm"] },
} as const;

export const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};
