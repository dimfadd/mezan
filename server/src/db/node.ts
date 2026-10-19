import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { DB, Stmt } from "./types";

// Adapter better-sqlite3 -> bentuk API D1, supaya kode route sama persis di lokal dan di Cloudflare.
class NodeStmt implements Stmt {
  constructor(private s: Database.Statement, private args: unknown[] = []) {}
  bind(...values: unknown[]): Stmt {
    return new NodeStmt(this.s, values.map(normalize));
  }
  async first<T>(): Promise<T | null> {
    if (!this.s.reader) {
      this.s.run(...this.args);
      return null;
    }
    return (this.s.get(...this.args) as T) ?? null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    if (!this.s.reader) {
      this.s.run(...this.args);
      return { results: [] };
    }
    return { results: this.s.all(...this.args) as T[] };
  }
  async run() {
    const r = this.s.run(...this.args);
    return { meta: { changes: r.changes } };
  }
  runSync() {
    return this.s.run(...this.args);
  }
}

function normalize(v: unknown) {
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === undefined) return null;
  return v;
}

export function openNodeDb(path: string): DB & { raw: Database.Database } {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const raw = new Database(path);
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");
  return {
    raw,
    prepare(sql: string) {
      return new NodeStmt(raw.prepare(sql));
    },
    async batch(statements: Stmt[]) {
      // Sama seperti D1: semua pernyataan jalan dalam satu transaksi, gagal satu batal semua.
      const tx = raw.transaction(() => statements.map((s) => (s as NodeStmt).runSync()));
      return tx();
    },
  };
}
