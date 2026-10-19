import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, Boxes, ClipboardList, LogOut, Menu as MenuIcon, QrCode, Settings, ShoppingBasket, UserRound,
  Users, UtensilsCrossed, AlertTriangle,
} from "lucide-react";
import { isManagement, useSession } from "../lib/session";
import { useApi, useMediaQuery } from "../lib/hooks";
import { date, ROLE_LABEL } from "../lib/format";
import { ThemeToggle } from "./ThemeToggle";
import { Modal } from "./ui";
import type { Order } from "../pages/store/types";

// ---------- Umpan pesanan aktif (dipakai bersama sidebar & papan pesanan) ----------
interface Feed {
  orders: Order[] | null;
  error: string | null;
  reload: () => Promise<void>;
  newCount: number;
}
const FeedCtx = createContext<Feed>({ orders: null, error: null, reload: async () => {}, newCount: 0 });
export const useOrderFeed = () => useContext(FeedCtx);

function chime() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.42);
  } catch {
    /* browser menolak audio sebelum ada interaksi */
  }
}

export function soundEnabled() {
  try {
    return localStorage.getItem("mezan-sound") !== "off";
  } catch {
    return true;
  }
}

function FeedProvider({ children }: { children: ReactNode }) {
  const { data, error, reload } = useApi<{ orders: Order[] }>("/api/store/orders?scope=active", { poll: 7000 });
  const orders = data?.orders ?? null;
  const newCount = orders?.filter((o) => o.status === "new").length ?? 0;
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!orders) return;
    const ids = new Set(orders.filter((o) => o.status === "new").map((o) => o.id));
    if (seen.current) {
      const fresh = [...ids].some((id) => !seen.current!.has(id));
      if (fresh && soundEnabled()) chime();
    }
    seen.current = ids;
    document.title = newCount > 0 ? `(${newCount}) Pesanan baru · Mezan` : "Mezan";
  }, [orders, newCount]);
  return <FeedCtx.Provider value={{ orders, error: error?.message ?? null, reload: () => reload(true), newCount }}>{children}</FeedCtx.Provider>;
}

// ---------- Navigasi ----------
interface NavItem {
  to: string;
  label: string;
  short?: string;
  icon: ReactNode;
  count?: number;
}

function SubscriptionBanner() {
  const { tenant, user } = useSession();
  if (!tenant) return null;
  const daysLeft = Math.ceil((tenant.period_end - Date.now()) / 86_400_000);
  const mgmt = isManagement(user?.role);
  if (tenant.locked) {
    return (
      <div className="banner danger" role="alert">
        <AlertTriangle aria-hidden="true" />
        <div>
          {tenant.status === "suspended" ? "Akun toko ini sedang dinonaktifkan." : "Masa langganan sudah habis."} Pesanan lewat QR dan kasir dihentikan sementara.
          {mgmt ? " Hubungi admin Mezan untuk memperpanjang. Data kamu tetap aman." : " Beri tahu pemilik toko."}
        </div>
      </div>
    );
  }
  if (!mgmt) return null;
  if (daysLeft < 0) {
    return (
      <div className="banner danger" role="alert">
        <AlertTriangle aria-hidden="true" />
        <div>Langganan lewat {Math.abs(daysLeft)} hari. Toko akan dikunci setelah masa tenggang {tenant.grace_days} hari. Perpanjang sekarang supaya kasir tetap jalan.</div>
      </div>
    );
  }
  if (daysLeft <= 5) {
    return (
      <div className="banner">
        <AlertTriangle aria-hidden="true" />
        <div>
          {tenant.status === "trial" ? "Masa coba" : "Langganan"} paket {tenant.plan_name} berakhir {daysLeft === 0 ? "hari ini" : `${daysLeft} hari lagi`} ({date(tenant.period_end)}).
        </div>
      </div>
    );
  }
  return null;
}

export function StoreShell() {
  return (
    <FeedProvider>
      <ShellInner />
    </FeedProvider>
  );
}

function ShellInner() {
  const { user, tenant, logout } = useSession();
  const { newCount } = useOrderFeed();
  const nav = useNavigate();
  const loc = useLocation();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [loc.pathname]);
  const compact = useMediaQuery("(max-width: 1099px)");
  if (!user || !tenant) return null;
  const mgmt = isManagement(user.role);
  const stockOn = !!tenant.inventory_enabled;

  const items: NavItem[] = [
    { to: "/toko/pesanan", label: "Pesanan", icon: <ClipboardList />, count: newCount },
    { to: "/toko/kasir", label: "Kasir", icon: <ShoppingBasket /> },
    ...(mgmt ? [{ to: "/toko/laporan", label: "Laporan", icon: <BarChart3 /> }] : []),
    { to: "/toko/menu", label: mgmt ? "Menu & produk" : "Menu", short: "Menu", icon: <UtensilsCrossed /> },
    ...(mgmt ? [{ to: "/toko/meja", label: "Meja & QR", short: "Meja", icon: <QrCode /> }] : []),
    ...(stockOn ? [{ to: "/toko/stok", label: "Stok", icon: <Boxes /> }] : []),
    ...(mgmt ? [{ to: "/toko/karyawan", label: "Karyawan", icon: <Users /> }] : []),
    ...(mgmt ? [{ to: "/toko/pengaturan", label: "Pengaturan", icon: <Settings /> }] : []),
  ];
  const primary = items.slice(0, 4);
  const rest = items.slice(4);

  const doLogout = async () => {
    await logout();
    nav("/masuk", { replace: true });
  };

  return (
    <div className="shell has-bottom-nav">
      <aside className="sidebar" aria-label="Navigasi utama">
        <a className="wordmark" href="/toko/pesanan" onClick={(e) => { e.preventDefault(); nav("/toko/pesanan"); }}>
          mezan<span className="dot">.</span>
        </a>
        <div className="store-chip">
          <div className="name">{tenant.name}</div>
          <div className="role">
            {user.name} · {ROLE_LABEL[user.role]}
          </div>
        </div>
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            {it.icon}
            <span>{it.short && compact ? it.short : it.label}</span>
            {!!it.count && <span className="count" aria-label={`${it.count} baru`}>{it.count}</span>}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          <NavLink to="/toko/akun" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <UserRound />
            <span>Akun saya</span>
          </NavLink>
          <ThemeToggle />
          <button type="button" className="nav-link" style={{ border: 0, background: "none", cursor: "pointer", width: "100%" }} onClick={doLogout}>
            <LogOut />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      <header className="topbar">
        <span className="title">{tenant.name}</span>
        <span className="tiny muted nowrap">{user.name.split(" ")[0]} · {ROLE_LABEL[user.role]}</span>
      </header>

      <main className="main" id="main">
        <SubscriptionBanner />
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Navigasi utama" style={{ gridTemplateColumns: `repeat(${primary.length + 1}, 1fr)` }}>
        {primary.map((it) => (
          <NavLink key={it.to} to={it.to} className={({ isActive }) => (isActive ? "active" : "")}>
            {it.icon}
            <span>{it.short ?? it.label}</span>
            {!!it.count && <span className="count">{it.count}</span>}
          </NavLink>
        ))}
        <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog">
          <MenuIcon />
          <span>Lainnya</span>
        </button>
      </nav>

      <Modal open={more} onClose={() => setMore(false)} title="Menu lainnya">
        <div className="sheet-list">
          {rest.map((it) => (
            <NavLink key={it.to} to={it.to}>
              {it.icon}
              {it.label}
            </NavLink>
          ))}
          <NavLink to="/toko/akun">
            <UserRound />
            Akun saya
          </NavLink>
          <ThemeToggle asSheet />
          <button type="button" onClick={doLogout}>
            <LogOut />
            Keluar
          </button>
        </div>
      </Modal>
    </div>
  );
}
