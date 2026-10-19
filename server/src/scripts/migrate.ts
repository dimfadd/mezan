import { resolve } from "node:path";
import { openNodeDb } from "../db/node";
import { migrate } from "../db/migrate";

const db = openNodeDb(resolve(process.env.DATABASE_PATH ?? "./data/mezan.db"));
migrate(db.raw, resolve("server/migrations"));
console.log("Database siap.");
