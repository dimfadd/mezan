import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Field, Segmented } from "../../components/ui";
import { ThemeToggle } from "../../components/ThemeToggle";
import { api } from "../../lib/api";
import { rupiah } from "../../lib/format";
import { useSession } from "../../lib/session";

function homeFor(role?: string) {
  return role === "platform_admin" ? "/admin" : "/toko/pesanan";
}

export function LandingPage() {
  const { user } = useSession();
  return (
    <div className="landing">
      <nav className="landing-nav" aria-label="Utama">
        <span className="wordmark">mezan<span className="dot">.</span></span>
        <div className="row">
          {user ? (
            <Link className="btn btn-primary" to={homeFor(user.role)}>Buka dasbor</Link>
          ) : (
            <>
              <Link className="btn btn-ghost" to="/masuk">Masuk</Link>
              <Link className="btn btn-primary" to="/daftar">Daftarkan usaha</Link>
            </>
          )}
        </div>
      </nav>

      <section className="landing-hero">
        <div>
          <h1>Pelanggan lihat dulu wujudnya, baru pesan.</h1>
          <p className="lead">
            Mezan memberi warung, kafe, dan toko kamu menu digital dengan foto dan video pendek di setiap meja. Pelanggan pindai QR, pilih, lalu pesanannya langsung masuk ke kasir. Stok dan laporan penjualan ikut tercatat.
          </p>
          <div className="row wrap">
            <Link className="btn btn-primary btn-lg" to="/daftar">Coba gratis 14 hari</Link>
            {import.meta.env.DEV && (
              <a className="btn btn-lg" href="/m/contoh-meja1">Lihat menu contoh</a>
            )}
          </div>
        </div>
        <div aria-label="Contoh tampilan tiket pesanan di kasir">
          <p className="tiny muted" style={{ marginBottom: 8 }}>Contoh tampilan di layar kasir</p>
          <div className="receipt-edge">
            <div className="demo-ticket">
              <div className="ticket-top">
                <div>
                  <div className="ticket-no num">#12</div>
                  <div className="small muted" style={{ marginTop: 4 }}>Meja 4 · Sari</div>
                </div>
                <span className="badge badge-new">Baru masuk</span>
              </div>
              <ul className="ticket-items">
                <li><span className="q num">2×</span><span>Ayam Geprek Sambal Bawang<span className="note">Catatan: level 1 saja</span></span></li>
                <li><span className="q num">2×</span><span>Es Jeruk Peras</span></li>
              </ul>
              <hr className="divider-dashed" style={{ margin: 0 }} />
              <div className="row between">
                <span className="strong money">{rupiah(52000)}</span>
                <span className="badge badge-warn">Belum bayar</span>
              </div>
              <div className="ticket-actions">
                <span className="btn btn-primary" aria-hidden="true">Terima & buat</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flow" aria-label="Cara kerja">
        <div className="flow-row">
          <span className="who">Pelanggan</span>
          <div>
            <h3>Pindai QR di meja</h3>
            <p className="muted">Tidak perlu pasang aplikasi. Menu terbuka di browser HP, lengkap dengan foto, video pendek, harga, dan tanda kalau sedang habis.</p>
          </div>
          <p className="muted">Pesanan dikirim dengan nama dan catatan (tidak pedas, es sedikit). Status pesanan bisa dipantau dari HP sampai makanan diantar.</p>
        </div>
        <div className="flow-row">
          <span className="who">Kasir & dapur</span>
          <div>
            <h3>Pesanan masuk berbunyi</h3>
            <p className="muted">Tiket muncul di papan pesanan dengan nomor antrean dan nomor meja. Terima, tandai siap, lalu terima pembayaran tunai, QRIS, atau transfer.</p>
          </div>
          <p className="muted">Pelanggan yang datang langsung tetap dicatat dari layar kasir yang sama. Struk bisa dicetak ke printer thermal.</p>
        </div>
        <div className="flow-row">
          <span className="who">Pemilik</span>
          <div>
            <h3>Atur menu, lihat laporan</h3>
            <p className="muted">Ubah harga, tambah foto atau video, dan tandai menu habis kapan saja. Laporan omzet, jam ramai, dan menu terlaris hanya bisa dibuka akun manajemen.</p>
          </div>
          <p className="muted">Pencatatan stok bisa dinyalakan kalau perlu, atau dibiarkan mati kalau cukup menu dan catatan pesanan.</p>
        </div>
      </section>

      <footer className="row between wrap" style={{ paddingTop: 28 }}>
        <span className="small muted">Mezan, aplikasi kasir dan menu digital.</span>
        <div style={{ width: 240 }}><ThemeToggle /></div>
      </footer>
    </div>
  );
}

function AuthLayout({ children, quote }: { children: React.ReactNode; quote: string }) {
  return (
    <div className="auth-page">
      <aside className="auth-side">
        <Link className="wordmark" to="/">mezan<span className="dot">.</span></Link>
        <blockquote>{quote}</blockquote>
        <span className="small" style={{ opacity: 0.85 }}>Menu digital, kasir, stok, dan laporan dalam satu tempat.</span>
      </aside>
      <main className="auth-form">
        <div className="box">{children}</div>
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
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? "Menyiapkan toko..." : "Buat akun toko"}</button>
      </form>
      <p className="small muted">Sudah punya akun? <Link to="/masuk">Masuk</Link>.</p>
    </AuthLayout>
  );
}
