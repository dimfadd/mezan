// Server lokal (Node). Untuk produksi di Cloudflare, lihat worker.ts.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "./app";
import { openNodeDb } from "./db/node";
import { migrate } from "./db/migrate";
import { diskStorage } from "./lib/storage-node";

loadDotEnv();
const port = Number(process.env.PORT ?? 8787);
const dbPath = resolve(process.env.DATABASE_PATH ?? "./data/mezan.db");
const uploadDir = resolve(process.env.UPLOAD_DIR ?? "./data/uploads");

const db = openNodeDb(dbPath);
migrate(db.raw, resolve("server/migrations"));

const app = createApp({ db, storage: diskStorage(uploadDir), secureCookies: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1" });

// Mode produksi lokal: sajikan hasil build web dari server yang sama.
const dist = resolve("web/dist");
if (process.env.NODE_ENV === "production" && existsSync(dist)) {
  app.use("/*", serveStatic({ root: "./web/dist" }));
  const index = readFileSync(resolve(dist, "index.html"), "utf8");
  app.get("*", (c) => c.html(index));
}

serve({ fetch: app.fetch, port }, () => {
  console.log(`Mezan API jalan di http://localhost:${port}`);
});

function loadDotEnv() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
