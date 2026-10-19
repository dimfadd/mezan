// Entry untuk Cloudflare Workers (tahap produksi). BELUM diuji di Cloudflare:
// jalankan `wrangler d1 migrations apply` lalu `wrangler deploy` saat siap pindah.
import { createApp } from "./app";
import type { DB } from "./db/types";
import type { MediaStorage } from "./lib/storage";

interface R2Like {
  put(key: string, value: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; size: number; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
}

interface WorkerEnv {
  DB: DB; // binding D1, API-nya sama dengan db/types.ts
  MEDIA: R2Like; // binding R2
  ASSETS: { fetch(req: Request): Promise<Response> };
}

function r2Storage(bucket: R2Like): MediaStorage {
  return {
    async put(key, data, contentType) {
      await bucket.put(key, data, { httpMetadata: { contentType } });
    },
    async get(key) {
      const o = await bucket.get(key);
      if (!o) return null;
      return { body: o.body, size: o.size, contentType: o.httpMetadata?.contentType ?? "application/octet-stream" };
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}

export default {
  async fetch(req: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/media/")) {
      const app = createApp({ db: env.DB, storage: r2Storage(env.MEDIA), secureCookies: true });
      return app.fetch(req);
    }
    return env.ASSETS.fetch(req);
  },
};
