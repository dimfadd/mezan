import { StrictMode, Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "@fontsource-variable/fredoka";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/700.css";
import "./styles/app.css";
import { SessionProvider, useSession, isManagement, isRetail } from "./lib/session";
import { applyTheme, watchSystemTheme } from "./lib/theme";
import { ConfirmProvider, Loading, ToastProvider } from "./components/ui";
import { LoginPage, RegisterPage } from "./pages/public/Public";
import { PrivacyPage, TermsPage } from "./pages/public/Legal";
import { CustomerMenuPage } from "./pages/customer/Menu";
import { OrderStatusPage } from "./pages/customer/OrderStatus";

// Halaman toko & admin dimuat terpisah, supaya pelanggan yang memindai QR hanya mengunduh halaman menu.
const lazyNamed = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const store = () => import("./pages/store/index");
const admin = () => import("./pages/admin/Admin");
const StoreShell = lazyNamed(store, "StoreShell");
const OrdersPage = lazyNamed(store, "OrdersPage");
const PosPage = lazyNamed(store, "PosPage");
const MenuManagePage = lazyNamed(store, "MenuManagePage");
const TablesPage = lazyNamed(store, "TablesPage");
const StockPage = lazyNamed(store, "StockPage");
const StaffPage = lazyNamed(store, "StaffPage");
const SettingsPage = lazyNamed(store, "SettingsPage");
const AccountPage = lazyNamed(store, "AccountPage");
const ReportsPage = lazyNamed(store, "ReportsPage");
const MenuDesignPage = lazyNamed(store, "MenuDesignPage");
const KitchenPage = lazyNamed(store, "KitchenPage");
const CashPage = lazyNamed(store, "CashPage");
const WaitlistPage = lazyNamed(store, "WaitlistPage");
const LoyaltyPage = lazyNamed(store, "LoyaltyPage");
const waitlist = () => import("./pages/customer/WaitlistJoin");
const WaitlistJoinPage = lazyNamed(waitlist, "WaitlistJoinPage");
const WaitlistStatusPage = lazyNamed(waitlist, "WaitlistStatusPage");
const AdminShell = lazyNamed(admin, "AdminShell");
const AdminOverview = lazyNamed(admin, "AdminOverview");
const AdminTenants = lazyNamed(admin, "AdminTenants");
const AdminTenantDetail = lazyNamed(admin, "AdminTenantDetail");
const AdminPlans = lazyNamed(admin, "AdminPlans");
const AdminSite = lazyNamed(() => import("./pages/admin/SiteContent"), "AdminSite");
// Landing berisi animasi simulasi; dipisah supaya pembeli yang memindai QR tidak ikut mengunduhnya.
const LandingPage = lazyNamed(() => import("./pages/public/landing/Landing"), "LandingPage");
const SolutionPage = lazyNamed(() => import("./pages/public/Solution"), "SolutionPage");

applyTheme();
watchSystemTheme();

/** Halaman awal toko: usaha makanan ke papan Pesanan, toko barang langsung ke Kasir. */
function StoreHome() {
  const { tenant } = useSession();
  return <Navigate to={isRetail(tenant) ? "kasir" : "pesanan"} replace />;
}

function Gate({ need, children }: { need: "store" | "management" | "platform"; children: ReactNode }) {
  const { user, ready } = useSession();
  if (!ready) return <div style={{ padding: 24 }}><Loading rows={3} /></div>;
  if (!user) return <Navigate to="/masuk" replace />;
  if (need === "platform" && user.role !== "platform_admin") return <Navigate to="/toko" replace />;
  if (need !== "platform" && user.role === "platform_admin") return <Navigate to="/admin" replace />;
  if (need === "management" && !isManagement(user.role)) return <Navigate to="/toko" replace />;
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="state" style={{ minHeight: "60dvh" }}>
      <h3>Halaman tidak ditemukan</h3>
      <p>Alamat ini tidak ada. Kalau kamu memindai QR meja, coba pindai ulang.</p>
      <a className="btn" href="/">Ke beranda</a>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConfirmProvider>
          <SessionProvider>
            <Suspense fallback={<div style={{ padding: 24 }}><Loading rows={3} /></div>}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/masuk" element={<LoginPage />} />
              <Route path="/daftar" element={<RegisterPage />} />
              <Route path="/solusi/:slug" element={<SolutionPage />} />
              <Route path="/syarat" element={<TermsPage />} />
              <Route path="/privasi" element={<PrivacyPage />} />
              <Route path="/m/:code" element={<CustomerMenuPage />} />
              <Route path="/m/:code/pesanan/:token" element={<OrderStatusPage />} />
              <Route path="/struk/:token" element={<OrderStatusPage />} />
              <Route path="/antre/:code" element={<WaitlistJoinPage />} />
              <Route path="/antre/:code/:token" element={<WaitlistStatusPage />} />
              <Route path="/toko" element={<Gate need="store"><StoreShell /></Gate>}>
                <Route index element={<StoreHome />} />
                <Route path="pesanan" element={<OrdersPage />} />
                <Route path="kasir" element={<PosPage />} />
                <Route path="dapur" element={<KitchenPage />} />
                <Route path="kas" element={<CashPage />} />
                <Route path="antrean" element={<WaitlistPage />} />
                <Route path="pelanggan" element={<Gate need="management"><LoyaltyPage /></Gate>} />
                <Route path="menu" element={<MenuManagePage />} />
                <Route path="stok" element={<StockPage />} />
                <Route path="akun" element={<AccountPage />} />
                <Route path="laporan" element={<Gate need="management"><ReportsPage /></Gate>} />
                <Route path="tampilan" element={<Gate need="management"><MenuDesignPage /></Gate>} />
                <Route path="meja" element={<Gate need="management"><TablesPage /></Gate>} />
                <Route path="karyawan" element={<Gate need="management"><StaffPage /></Gate>} />
                <Route path="pengaturan" element={<Gate need="management"><SettingsPage /></Gate>} />
              </Route>
              <Route path="/admin" element={<Gate need="platform"><AdminShell /></Gate>}>
                <Route index element={<AdminOverview />} />
                <Route path="toko" element={<AdminTenants />} />
                <Route path="toko/:id" element={<AdminTenantDetail />} />
                <Route path="paket" element={<AdminPlans />} />
                <Route path="situs" element={<AdminSite />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </SessionProvider>
        </ConfirmProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
