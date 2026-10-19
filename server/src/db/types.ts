// Antarmuka database yang sengaja meniru subset API Cloudflare D1.
// Lokal: dibungkus better-sqlite3 (lihat db/node.ts). Produksi: env.DB dari D1 langsung.
export interface Stmt {
  bind(...values: unknown[]): Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

export interface DB {
  prepare(sql: string): Stmt;
  batch(statements: Stmt[]): Promise<unknown[]>;
}

export async function all<T = Record<string, unknown>>(db: DB, sql: string, ...args: unknown[]): Promise<T[]> {
  const r = await db.prepare(sql).bind(...args).all<T>();
  return r.results;
}

export async function first<T = Record<string, unknown>>(db: DB, sql: string, ...args: unknown[]): Promise<T | null> {
  return db.prepare(sql).bind(...args).first<T>();
}

export async function run(db: DB, sql: string, ...args: unknown[]): Promise<number> {
  const r = await db.prepare(sql).bind(...args).run();
  return r.meta.changes;
}

export function stmt(db: DB, sql: string, ...args: unknown[]): Stmt {
  return db.prepare(sql).bind(...args);
}
