import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

export type Role = "platform_admin" | "owner" | "manager" | "staff";
export interface Me {
  id: string;
  name: string;
  login: string;
  role: Role;
  tenant_id: string | null;
}
export interface StoreInfo {
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
  welcome_note: string;
  welcome_note_en: string;
  plan_name: string;
  max_tables: number;
  max_staff: number;
  allow_video: number;
  allow_inventory: number;
  allow_analytics: number;
  allow_branding: number;
  max_photos: number;
  max_videos: number;
  menu_theme: string;
  locked: boolean;
  grace_days: number;
}

export interface RuntimeInfo {
  ephemeral: boolean;
  uploadLimitMb: number;
  directUpload: boolean;
}

// Disimpan di modul supaya util unggah (lib/media.ts) bisa membacanya tanpa hook.
export let runtimeInfo: RuntimeInfo = { ephemeral: false, uploadLimitMb: 15, directUpload: false };

interface SessionCtx {
  runtime: RuntimeInfo;
  user: Me | null;
  tenant: StoreInfo | null;
  ready: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ user: Me | null; tenant: StoreInfo | null; ready: boolean; runtime: RuntimeInfo }>({ user: null, tenant: null, ready: false, runtime: runtimeInfo });
  const refresh = useCallback(async () => {
    try {
      const r = await api.get<{ user: Me | null; tenant: StoreInfo | null; runtime?: RuntimeInfo }>("/api/auth/me");
      if (r.runtime) runtimeInfo = r.runtime;
      setState({ user: r.user, tenant: r.tenant ?? null, ready: true, runtime: runtimeInfo });
    } catch {
      setState((s) => ({ ...s, ready: true }));
    }
  }, []);
  const logout = useCallback(async () => {
    await api.post("/api/auth/logout").catch(() => {});
    setState((s) => ({ ...s, user: null, tenant: null, ready: true }));
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return <Ctx.Provider value={{ ...state, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSession di luar SessionProvider");
  return c;
}

export const isManagement = (r?: Role) => r === "owner" || r === "manager";
