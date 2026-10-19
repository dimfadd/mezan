import { HTTPException } from "hono/http-exception";

export function fail(status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429, message: string): never {
  throw new HTTPException(status, { message });
}

/** Tanggal bisnis (YYYY-MM-DD) menurut zona waktu toko. */
export function businessDay(ms: number, tzOffsetMinutes: number) {
  return new Date(ms + tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** Epoch ms untuk jam 00:00 waktu toko pada tanggal bisnis tertentu. */
export function startOfBusinessDay(day: string, tzOffsetMinutes: number) {
  return Date.parse(`${day}T00:00:00Z`) - tzOffsetMinutes * 60_000;
}
