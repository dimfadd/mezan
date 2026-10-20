// Entry fungsi serverless untuk Vercel. Dibundel jadi satu file oleh scripts/build-vercel.mjs.
import { getRequestListener } from "@hono/node-server";
import { createApp } from "./app";
import { migrateRemote, openTmpSqlite, openTurso, type ScriptDB } from "./db/remote";
import { seedDemo } from "./db/demoSeed";
import { blobStorage } from "./lib/storage-blob";
import { diskStorage } from "./lib/storage-node";

let ready: Promise<ReturnType<typeof createApp>> | null = null;

async function boot() {
  const turso = process.env.TURSO_DATABASE_URL;
  const db: ScriptDB = turso ? openTurso(turso, process.env.TURSO_AUTH_TOKEN) : await openTmpSqlite("/tmp/mezan.db");
  await migrateRemote(db);
  // Data contoh diisi otomatis kalau database masih kosong. Matikan dengan DEMO_SEED=0 untuk produksi.
  // ADMIN_PASSWORD (minimal 12 karakter) mengganti sandi admin contoh, supaya panel admin tidak terbuka untuk umum.
  const adminPassword = process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 12 ? process.env.ADMIN_PASSWORD : undefined;
  if (process.env.DEMO_SEED !== "0") await seedDemo(db, { adminPassword });
  const blob = process.env.BLOB_READ_WRITE_TOKEN;
  return createApp({
    db,
    storage: blob ? blobStorage(blob) : diskStorage("/tmp/mezan-uploads"),
    secureCookies: true,
    runtime: { ephemeral: !turso, uploadLimitMb: Number(process.env.MAX_UPLOAD_MB ?? 4), directUpload: !!blob },
    blobToken: blob,
  });
}

const listener = getRequestListener(async (req) => {
  ready ??= boot().catch((e) => {
    ready = null; // coba lagi di permintaan berikutnya
    throw e;
  });
  const app = await ready;
  // Vercel bisa meneruskan path asli lewat query __p (lihat config routes di build-vercel.mjs).
  const url = new URL(req.url);
  const original = url.searchParams.get("__p");
  if (original) {
    url.searchParams.delete("__p");
    url.pathname = original;
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    return app.fetch(new Request(url, { method: req.method, headers: req.headers, body: hasBody ? req.body : undefined, ...(hasBody ? { duplex: "half" } : {}) } as RequestInit));
  }
  return app.fetch(req);
});

export default listener;
