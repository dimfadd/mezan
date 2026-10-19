// Isi database lokal dengan data contoh (fiktif).
import { resolve } from "node:path";
import { openNodeDb } from "../db/node";
import { migrate } from "../db/migrate";
import { DEMO_ACCOUNTS, seedDemo } from "../db/demoSeed";

const db = openNodeDb(resolve(process.env.DATABASE_PATH ?? "./data/mezan.db"));
migrate(db.raw, resolve("server/migrations"), false);

seedDemo(db).then((done) => {
  if (!done) {
    console.log("Database sudah berisi data. Jalankan `npm run db:reset` kalau mau mulai ulang.");
    return;
  }
  console.log("\nData contoh siap.\n");
  for (const [role, login, pw] of DEMO_ACCOUNTS) console.log(`  ${role.padEnd(16)} ${login.padEnd(20)} / ${pw}`);
  console.log("\n  Menu pelanggan (Meja 1): http://localhost:5173/m/contoh-meja1\n");
});
