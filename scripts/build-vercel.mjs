// Build untuk Vercel memakai Build Output API (.vercel/output):
// - static/   : hasil vite build (web)
// - functions/api.func : seluruh API dibundel jadi satu file (tanpa node_modules)
// - config.json : aturan routing (API, media, fallback SPA)
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

const OUT = ".vercel/output";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/functions/api.func`, { recursive: true });
cpSync("web/dist", `${OUT}/static`, { recursive: true });

await build({
  entryPoints: ["server/src/vercel.ts"],
  outfile: `${OUT}/functions/api.func/index.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  minify: true,
  sourcemap: false,
  external: ["better-sqlite3"],
  // Beberapa dependensi masih CommonJS dan memanggil require() untuk modul bawaan Node.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: "warning",
});

writeFileSync(
  `${OUT}/functions/api.func/.vc-config.json`,
  JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false, supportsResponseStreaming: true, maxDuration: 30 }, null, 2),
);

writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "^/assets/(.*)$", headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true },
        { src: "^/sw\\.js$", headers: { "cache-control": "no-cache" }, continue: true },
        // API dan media ke satu fungsi; path asli dikirim lewat __p supaya pasti utuh.
        { src: "^/(api/.*|media/.*)$", dest: "/api?__p=/$1" },
        { handle: "filesystem" },
        // Selain file statis, semua alamat (mis. /toko/pesanan, /m/kode) dibuka oleh aplikasi web.
        { src: "^/(.*)$", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);
console.log("Build Vercel siap di .vercel/output");
