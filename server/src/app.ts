import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { DB } from "./db/types";
import type { MediaStorage } from "./lib/storage";
import { loadSession, type SessionUser, type Tenant } from "./lib/auth";
import { authRoutes } from "./routes/auth";
import { publicRoutes } from "./routes/public";
import { storeRoutes } from "./routes/store";
import { platformRoutes } from "./routes/platform";

export type Env = {
  Variables: {
    db: DB;
    storage: MediaStorage;
    user: SessionUser | null;
    tenant: Tenant | null;
    secureCookies: boolean;
    runtime: RuntimeInfo;
  };
};

export interface AppDeps {
  db: DB;
  storage: MediaStorage;
  secureCookies?: boolean;
  /** Info lingkungan yang ditampilkan ke pengguna (mis. mode uji dengan database sementara). */
  runtime?: RuntimeInfo;
}

export interface RuntimeInfo {
  ephemeral: boolean; // true = data bisa hilang (database sementara)
  uploadLimitMb: number; // batas unggah per file (Vercel membatasi body ~4,5 MB)
}

export function createApp(deps: AppDeps) {
  const app = new Hono<Env>();

  app.use("*", async (c, next) => {
    c.set("db", deps.db);
    c.set("storage", deps.storage);
    c.set("secureCookies", deps.secureCookies ?? false);
    c.set("runtime", deps.runtime ?? { ephemeral: false, uploadLimitMb: 15 });
    await next();
  });

  // Lindungi dari permintaan palsu lintas situs (CSRF): semua perubahan wajib JSON/multipart
  // dan tidak boleh datang dari situs lain.
  app.use("/api/*", async (c, next) => {
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      const site = c.req.header("sec-fetch-site");
      if (site === "cross-site") return c.json({ error: "Permintaan dari situs lain ditolak." }, 403);
      const type = c.req.header("content-type") ?? "";
      const ok = type.startsWith("application/json") || (type.startsWith("multipart/form-data") && c.req.path === "/api/store/media");
      if (!ok) return c.json({ error: "Format permintaan tidak didukung." }, 415);
    }
    await next();
  });

  app.use("/api/*", async (c, next) => {
    const { user, tenant } = await loadSession(c);
    c.set("user", user);
    c.set("tenant", tenant);
    await next();
    c.header("Cache-Control", "no-store");
  });

  app.route("/api/auth", authRoutes);
  app.route("/api/public", publicRoutes);
  app.route("/api/store", storeRoutes);
  app.route("/api/platform", platformRoutes);

  // File media (gambar/video menu). Mendukung Range supaya video bisa diputar di Safari/iOS.
  app.get("/media/*", async (c) => {
    let key: string;
    try {
      key = decodeURIComponent(c.req.path.replace(/^\/media\//, ""));
    } catch {
      return c.text("Tidak ditemukan", 404);
    }
    if (c.var.storage.publicUrl) {
      const url = await c.var.storage.publicUrl(key);
      if (!url) return c.text("Tidak ditemukan", 404);
      return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "public, max-age=86400" } });
    }
    const obj = await c.var.storage.get(key);
    if (!obj) return c.text("Tidak ditemukan", 404);
    const headers: Record<string, string> = {
      "Content-Type": obj.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    };
    const range = c.req.header("range");
    if (range && obj.body instanceof Uint8Array) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        const size = obj.size;
        const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
        const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
        if (start >= size || start > end) {
          return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
        }
        const chunk = obj.body.slice(start, end + 1);
        return new Response(chunk, {
          status: 206,
          headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(chunk.length) },
        });
      }
    }
    return new Response(obj.body as BodyInit, { headers: { ...headers, "Content-Length": String(obj.size) } });
  });

  app.notFound((c) => {
    if (c.req.path.startsWith("/api/")) return c.json({ error: "Alamat API tidak dikenal." }, 404);
    return c.text("Tidak ditemukan", 404);
  });

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return c.json({ error: first?.message ?? "Data tidak valid.", field: first?.path.join(".") }, 400);
    }
    console.error(err);
    return c.json({ error: "Terjadi kesalahan di server. Coba lagi sebentar lagi." }, 500);
  });

  return app;
}

export { fail } from "./lib/http";
