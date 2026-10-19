// Adapter database untuk deploy serverless (Vercel).
// - TURSO_DATABASE_URL ada: pakai Turso (libSQL di cloud, SQL sama dengan SQLite/D1). Data permanen.
// - Tidak ada: pakai node:sqlite di /tmp. Hanya untuk melihat-lihat, data hilang saat server tidur.
import { createClient, type Client, type InValue } from "@libsql/client/web";
import type { DB, Stmt } from "./types";
import { MIGRATIONS } from "./migrations.gen";

export type ScriptDB = DB & { execScript(sql: string): Promise<void> };

const norm = (v: unknown): InValue => (typeof v === "boolean" ? (v ? 1 : 0) : v === undefined ? null : (v as InValue));

class LibsqlStmt implements Stmt {
  constructor(readonly client: Client, readonly sql: string, readonly args: InValue[] = []) {}
  bind(...values: unknown[]): Stmt {
    return new LibsqlStmt(this.client, this.sql, values.map(norm));
  }
  private async rows<T>() {
    const rs = await this.client.execute({ sql: this.sql, args: this.args });
    return rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])) as T);
  }
  async first<T>() {
    return (await this.rows<T>())[0] ?? null;
  }
  async all<T>() {
    return { results: await this.rows<T>() };
  }
  async run() {
    const rs = await this.client.execute({ sql: this.sql, args: this.args });
    return { meta: { changes: rs.rowsAffected } };
  }
}

export function openTurso(url: string, authToken?: string): ScriptDB {
  const client = createClient({ url, authToken });
  return {
    prepare: (sql) => new LibsqlStmt(client, sql),
    async batch(stmts) {
      // Satu transaksi tulis, sama seperti D1 batch.
      return client.batch(stmts.map((s) => ({ sql: (s as LibsqlStmt).sql, args: (s as LibsqlStmt).args })), "write");
    },
    async execScript(sql) {
      await client.executeMultiple(sql);
    },
  };
}

type SqliteRow = Record<string, unknown>;
interface NodeSqlite {
  prepare(sql: string): { get(...a: unknown[]): SqliteRow | undefined; all(...a: unknown[]): SqliteRow[]; run(...a: unknown[]): { changes: number | bigint } };
  exec(sql: string): void;
}

class NodeSqliteStmt implements Stmt {
  constructor(readonly db: NodeSqlite, readonly sql: string, readonly args: unknown[] = []) {}
  bind(...values: unknown[]): Stmt {
    return new NodeSqliteStmt(this.db, this.sql, values.map(norm));
  }
  async first<T>() {
    return (this.db.prepare(this.sql).get(...this.args) as T) ?? null;
  }
  async all<T>() {
    return { results: this.db.prepare(this.sql).all(...this.args) as T[] };
  }
  async run() {
    return { meta: { changes: Number(this.db.prepare(this.sql).run(...this.args).changes) } };
  }
  runSync() {
    this.db.prepare(this.sql).run(...this.args);
  }
}

export async function openTmpSqlite(path: string): Promise<ScriptDB> {
  const { DatabaseSync } = (await import("node:sqlite")) as unknown as { DatabaseSync: new (p: string) => NodeSqlite };
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  return {
    prepare: (sql) => new NodeSqliteStmt(db, sql),
    async batch(stmts) {
      db.exec("BEGIN");
      try {
        for (const s of stmts) (s as NodeSqliteStmt).runSync();
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return [];
    },
    async execScript(sql) {
      db.exec(sql);
    },
  };
}

/** Terapkan migrasi yang belum jalan. Isi SQL di-embed saat build (migrations.gen.ts). */
export async function migrateRemote(db: ScriptDB) {
  await db.execScript("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
  const done = new Set((await db.prepare("SELECT name FROM _migrations").all<{ name: string }>()).results.map((r) => r.name));
  for (const m of MIGRATIONS) {
    if (done.has(m.name)) continue;
    await db.execScript(m.sql);
    await db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").bind(m.name, Date.now()).run();
  }
}
