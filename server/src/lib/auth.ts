import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "../app";
import { fail } from "./http";
import { first, run } from "../db/types";
import { randomToken, sha256 } from "./security";

export type Role = "platform_admin" | "owner" | "manager" | "staff";

export interface SessionUser {
  id: string;
  tenant_id: string | null;
  name: string;
  login: string;
  role: Role;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  kind: string;
  status: "trial" | "active" | "past_due" | "suspended";
  period_end: number;
  address: string;
  phone: string;
  logo_url: string | null;
  tax_rate: number;
  service_rate: number;
  inventory_enabled: number;
  qr_ordering_enabled: number;
  tz_offset_minutes: number;
  welcome_note: string;
  welcome_note_en: string;
  plan_id: string;
  plan_name: string;
  plan_code: string;
  max_tables: number;
  max_staff: number;
  allow_video: number;
  allow_inventory: number;
  allow_analytics: number;
  allow_branding: number;
  max_photos: number;
  max_videos: number;
  menu_theme: string;
  takeaway_code: string | null;
  takeaway_qr_enabled: number;
  geo_mode: "off" | "flag" | "block";
  geo_lat: number | null;
  geo_lng: number | null;
  geo_radius_m: number;
  google_review_url: string;
  loyalty_enabled: number;
  loyalty_target: number;
  loyalty_min_spend: number;
  loyalty_reward: string;
  waitlist_enabled: number;
  waitlist_code: string | null;
  kitchen_lanes: number;
  eta_enabled: number;
}

export const COOKIE = "mezan_session";
const SESSION_DAYS = 30;
export const GRACE_DAYS = 3;

export const TENANT_SELECT = `
  SELECT t.*, p.name AS plan_name, p.code AS plan_code, p.max_tables, p.max_staff,
         p.allow_video, p.allow_inventory, p.allow_analytics, p.allow_branding, p.max_photos, p.max_videos
  FROM tenants t JOIN plans p ON p.id = t.plan_id`;

// Toko terkunci kalau dinonaktifkan admin, atau langganan lewat lebih dari masa tenggang.
export function tenantLocked(t: Pick<Tenant, "status" | "period_end">, now = Date.now()) {
  if (t.status === "suspended") return true;
  return now > t.period_end + GRACE_DAYS * 86_400_000;
}

export async function loadSession(c: Context<Env>): Promise<{ user: SessionUser | null; tenant: Tenant | null }> {
  const token = getCookie(c, COOKIE);
  if (!token) return { user: null, tenant: null };
  const db = c.var.db;
  const row = await first<SessionUser & { expires_at: number; active: number }>(
    db,
    `SELECT u.id, u.tenant_id, u.name, u.login, u.role, u.active, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    await sha256(token),
  );
  if (!row || row.expires_at < Date.now() || !row.active) return { user: null, tenant: null };
  const user: SessionUser = { id: row.id, tenant_id: row.tenant_id, name: row.name, login: row.login, role: row.role };
  let tenant: Tenant | null = null;
  if (user.tenant_id) tenant = await first<Tenant>(db, `${TENANT_SELECT} WHERE t.id = ?`, user.tenant_id);
  return { user, tenant };
}

export async function startSession(c: Context<Env>, userId: string) {
  const token = randomToken(32);
  const now = Date.now();
  const expires = now + SESSION_DAYS * 86_400_000;
  await run(c.var.db, "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)", await sha256(token), userId, expires, now);
  await run(c.var.db, "DELETE FROM sessions WHERE user_id = ? AND expires_at < ?", userId, now);
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: c.var.secureCookies,
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession(c: Context<Env>) {
  const token = getCookie(c, COOKIE);
  if (token) await run(c.var.db, "DELETE FROM sessions WHERE id = ?", await sha256(token));
  deleteCookie(c, COOKIE, { path: "/" });
}

export const MANAGEMENT: Role[] = ["owner", "manager"];
export const ALL_STORE: Role[] = ["owner", "manager", "staff"];

/** Wajib login sebagai pengguna toko dengan salah satu peran yang diizinkan. */
export function requireStore(roles: Role[] = ALL_STORE): MiddlewareHandler<Env> {
  return async (c, next) => {
    const u = c.var.user;
    if (!u) fail(401, "Sesi kamu habis. Silakan masuk lagi.");
    if (!u.tenant_id || !c.var.tenant) fail(403, "Akun ini bukan akun toko.");
    if (!roles.includes(u.role)) fail(403, "Bagian ini hanya untuk manajemen toko.");
    await next();
  };
}

export const requirePlatform: MiddlewareHandler<Env> = async (c, next) => {
  const u = c.var.user;
  if (!u) fail(401, "Sesi kamu habis. Silakan masuk lagi.");
  if (u.role !== "platform_admin") fail(403, "Bagian ini hanya untuk admin Pesan.in.");
  await next();
};

export function storeOf(c: Context<Env>) {
  const t = c.var.tenant;
  if (!t) fail(403, "Akun ini bukan akun toko.");
  return t;
}
