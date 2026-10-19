// Menyalin isi server/migrations/*.sql ke modul TS supaya ikut terbundel di fungsi serverless.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const dir = "server/migrations";
const list = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((name) => ({ name, sql: readFileSync(`${dir}/${name}`, "utf8") }));
const out = `// DIBUAT OTOMATIS oleh scripts/gen-migrations.mjs. Jangan diedit, ubah file .sql lalu jalankan npm run gen.\nexport const MIGRATIONS: { name: string; sql: string }[] = ${JSON.stringify(list, null, 2)};\n`;
writeFileSync("server/src/db/migrations.gen.ts", out);
console.log(`migrasi di-embed: ${list.map((m) => m.name).join(", ")}`);
