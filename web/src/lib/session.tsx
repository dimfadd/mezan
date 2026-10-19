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
  plan_name: string;
  max_tables: number;
  max_staff: number;
  allow_video: number;
  allow_inventory: number;
  allow_analytics: number;
  allow_branding: number;
  menu_theme: string;
  locked: boolean;
  grace_days: number;
}

interface SessionCtx {
  user: Me | null;
  tenant: StoreInfo | null;
  ready: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ user: Me | null; tenant: StoreInfo | null; ready: boolean }>({ user: null, tenant: null, ready: false });
  const refresh = useCallback(async () => {
    try {
      const r = await api.get<{ user: Me | null; tenant: StoreInfo | null }>("/api/auth/me");
      setState({ user: r.user, tenant: r.tenant ?? null, ready: true });
    } catch {
      setState((s) => ({ ...s, ready: true }));
    }
  }, []);
  const logout = useCallback(async () => {
    await api.post("/api/auth/logout").catch(() => {});
    setState({ user: null, tenant: null, ready: true });
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
