import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Field, Segmented } from "../../components/ui";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import { LegalFoot } from "./Legal";

function homeFor(role?: string) {
  return role === "platform_admin" ? "/admin" : "/toko";
}

function AuthLayout({ children, quote }: { children: React.ReactNode; quote: string }) {
  return (
    <div className="auth-page">
      <aside className="auth-side">
        <Link className="wordmark" to="/">pesan<span className="dot">.</span>in</Link>
        <blockquote>{quote}</blockquote>
        <span className="small" style={{ opacity: 0.85 }}>Menu digital, kasir, stok, dan laporan dalam satu tempat.</span>
      </aside>
      <main className="auth-form">
        <div className="box">
          {children}
          <LegalFoot compact />
        </div>
      </main>
    </div>
  );
}

export function LoginPage() {
  const { user, refresh, ready, runtime } = useSession();
  const nav = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (ready && user) return <Navigate to={homeFor(user.role)} replace />;

  return (
    <AuthLayout quote="Buka kasir, pesanan dari meja sudah menunggu.">
      <div>
        <h1>Masuk</h1>
        <p className="muted" style={{ marginTop: 6 }}>Untuk pemilik, manajer, dan karyawan toko.</p>
      </div>
      {runtime.ephemeral && (
        <p className="banner" role="note" style={{ margin: 0 }}>
          Server uji. Coba dengan akun contoh pemilik@contoh.id / contoh12345 atau kasir@contoh.id / contoh12345. Data bisa kembali ke awal sewaktu-waktu.
        </p>
      )}
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api.post("/api/auth/login", { login, password });
            await refresh();
            const me = await api.get<{ user: { role: string } | null }>("/api/auth/me");
            nav(homeFor(me.user?.role), { replace: true });
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Email atau username" htmlFor="l-login">
          <input id="l-login" className="input" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none" required autoFocus />
        </Field>
        <Field label="Kata sandi" htmlFor="l-pw">
          <input id="l-pw" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        {error && <p role="alert" style={{ color: "var(--danger)", fontWeight: 600 }}>{error}</p>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? "Memeriksa..." : "Masuk"}</button>
      </form>
      <p className="small muted">
        Karyawan lupa kata sandi? Minta pemilik toko menggantinya di menu Karyawan. Belum punya akun toko? <Link to="/daftar">Daftarkan usaha</Link>.
      </p>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { user, refresh, ready } = useSession();
  const nav = useNavigate();
  const [f, setF] = useState({ storeName: "", kind: "warung" as "warung" | "kafe" | "resto" | "toko", ownerName: "", login: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (ready && user) return <Navigate to={homeFor(user.role)} replace />;

  return (
    <AuthLayout quote="Empat belas hari untuk mencoba, tanpa kartu kredit.">
      <div>
        <h1>Daftarkan usaha</h1>
        <p className="muted" style={{ marginTop: 6 }}>Kamu akan masuk sebagai pemilik. Akun karyawan bisa dibuat setelahnya.</p>
      </div>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api.post("/api/auth/register", f);
            await refresh();
            nav("/toko/menu", { replace: true });
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Nama usaha" htmlFor="r-store">
          <input id="r-store" className="input" value={f.storeName} onChange={(e) => setF({ ...f, storeName: e.target.value })} required minLength={2} maxLength={80} placeholder="Mis. Warung Bu Sri" />
        </Field>
        <div className="field">
          <span className="field-label">Jenis usaha</span>
          <Segmented label="Jenis usaha" value={f.kind} onChange={(kind) => setF({ ...f, kind })} options={[{ value: "warung", label: "Warung" }, { value: "kafe", label: "Kafe" }, { value: "resto", label: "Resto" }, { value: "toko", label: "Toko" }]} />
        </div>
        <Field label="Nama kamu" htmlFor="r-name">
          <input id="r-name" className="input" value={f.ownerName} onChange={(e) => setF({ ...f, ownerName: e.target.value })} required minLength={2} maxLength={80} autoComplete="name" />
        </Field>
        <Field label="Email" htmlFor="r-login" hint="Dipakai untuk masuk.">
          <input id="r-login" className="input" type="email" value={f.login} onChange={(e) => setF({ ...f, login: e.target.value })} required autoComplete="email" />
        </Field>
        <Field label="Kata sandi" htmlFor="r-pw" hint="Minimal 8 karakter.">
          <input id="r-pw" className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} autoComplete="new-password" />
        </Field>
        {error && <p role="alert" style={{ color: "var(--danger)", fontWeight: 600 }}>{error}</p>}
        <p className="tiny muted">
          Dengan membuat akun, kamu menyetujui <Link to="/syarat">Syarat & Ketentuan</Link> dan <Link to="/privasi">Kebijakan Privasi</Link> {"Pesan.in"}.
        </p>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? "Menyiapkan toko..." : "Buat akun toko"}</button>
      </form>
      <p className="small muted">Sudah punya akun? <Link to="/masuk">Masuk</Link>.</p>
    </AuthLayout>
  );
}
