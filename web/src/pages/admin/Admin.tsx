import { useState } from "react";
import { NavLink, Outlet, useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Building2, CreditCard, Gauge, LogOut, Plus, Search } from "lucide-react";
import { Empty, ErrorState, Field, Loading, Modal, MoneyInput, PageHead, Switch, useToast } from "../../components/ui";
import { ThemeToggle } from "../../components/ThemeToggle";
import { api } from "../../lib/api";
import { ago, date, KIND_LABEL, number, ROLE_LABEL, rupiah } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { useSession } from "../../lib/session";

const STATUS: Record<string, { label: string; cls: string }> = {
  trial: { label: "Masa coba", cls: "badge-info" },
  active: { label: "Aktif", cls: "badge-ok" },
  past_due: { label: "Menunggu bayar", cls: "badge-warn" },
  suspended: { label: "Dinonaktifkan", cls: "badge-danger" },
};

function effectiveStatus(t: { status: string; period_end: number }) {
  if (t.status !== "suspended" && t.period_end < Date.now()) return { label: "Lewat jatuh tempo", cls: "badge-danger" };
  return STATUS[t.status];
}

export function AdminShell() {
  const { user, logout } = useSession();
  const nav = useNavigate();
  const items = [
    { to: "/admin", label: "Ringkasan", icon: <Gauge />, end: true },
    { to: "/admin/toko", label: "Toko", icon: <Building2 /> },
    { to: "/admin/paket", label: "Paket", icon: <CreditCard /> },
  ];
  return (
    <div className="shell has-bottom-nav">
      <aside className="sidebar" aria-label="Navigasi admin">
        <span className="wordmark">mezan<span className="dot">.</span></span>
        <div className="store-chip">
          <div className="name">Admin platform</div>
          <div className="role">{user?.name}</div>
        </div>
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            {i.icon}
            <span>{i.label}</span>
          </NavLink>
        ))}
        <div className="sidebar-foot">
          <ThemeToggle />
          <button type="button" className="nav-link" style={{ border: 0, background: "none", cursor: "pointer", width: "100%" }} onClick={async () => { await logout(); nav("/masuk"); }}>
            <LogOut />
            <span>Keluar</span>
          </button>
        </div>
      </aside>
      <header className="topbar">
        <span className="title">Admin Mezan</span>
        <button className="icon-btn" aria-label="Keluar" onClick={async () => { await logout(); nav("/masuk"); }}><LogOut /></button>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Navigasi admin" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? "active" : "")}>
            {i.icon}
            <span>{i.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

interface Overview {
  counts: { total: number; trial: number; active: number; lapsed: number; suspended: number };
  mrr: number;
  signups30: number;
  expiring: { id: string; name: string; status: string; period_end: number; plan_name: string }[];
  recentPayments: { amount: number; months: number; created_at: number; tenant_name: string }[];
}

export function AdminOverview() {
  const { data, error, loading, reload } = useApi<Overview>("/api/platform/overview");
  if (error) return <ErrorState message={error.message} onRetry={() => reload()} />;
  if (loading || !data) return <Loading rows={3} height={100} />;
  const c = data.counts;
  return (
    <>
      <PageHead title="Ringkasan" sub="Kondisi seluruh toko yang memakai Mezan." />
      <div className="kpis" style={{ marginBottom: 20 }}>
        <div className="kpi hero">
          <span className="label">Pendapatan bulanan berulang</span>
          <span className="value">{rupiah(data.mrr)}</span>
          <span className="delta">dari {number(c.active)} toko berlangganan aktif</span>
        </div>
        <div className="kpi"><span className="label">Total toko</span><span className="value">{number(c.total)}</span><span className="delta">{number(data.signups30)} daftar dalam 30 hari</span></div>
        <div className="kpi"><span className="label">Masa coba</span><span className="value">{number(c.trial)}</span><span className="delta">calon pelanggan berbayar</span></div>
        <div className="kpi"><span className="label">Lewat jatuh tempo</span><span className="value">{number(c.lapsed)}</span><span className="delta">{number(c.suspended)} dinonaktifkan</span></div>
      </div>
      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><div><h2>Perlu ditagih</h2><p>Berakhir dalam 7 hari atau baru lewat jatuh tempo.</p></div></div>
          {data.expiring.length === 0 ? <p className="muted small">Tidak ada.</p> : (
            <div className="stack-sm">
              {data.expiring.map((t) => (
                <Link key={t.id} to={`/admin/toko/${t.id}`} className="row between" style={{ textDecoration: "none", color: "inherit", borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                  <span><span className="strong">{t.name}</span> <span className="muted small">{t.plan_name}</span></span>
                  <span className={`badge ${t.period_end < Date.now() ? "badge-danger" : "badge-warn"}`}>{date(t.period_end, { day: "numeric", month: "short" })}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Pembayaran terakhir</h2></div>
          {data.recentPayments.length === 0 ? <p className="muted small">Belum ada pembayaran tercatat.</p> : (
            <div className="stack-sm">
              {data.recentPayments.map((p, i) => (
                <div key={i} className="row between small" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                  <span>{p.tenant_name} · {p.months} bln <span className="muted">· {date(p.created_at, { day: "numeric", month: "short" })}</span></span>
                  <span className="money strong">{rupiah(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

interface TenantRow {
  id: string;
  name: string;
  kind: string;
  status: string;
  period_end: number;
  created_at: number;
  plan_name: string;
  owner_login: string | null;
  owner_name: string | null;
  last_order_at: number | null;
  orders_30d: number;
}
interface Plan {
  id: string;
  code: string;
  name: string;
  price_monthly: number;
  max_tables: number;
  max_staff: number;
  allow_video: number;
  allow_inventory: number;
  allow_analytics: number;
  active: number;
  sort: number;
  tenant_count?: number;
}

export function AdminTenants() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, error, loading, reload } = useApi<{ tenants: TenantRow[] }>(`/api/platform/tenants?q=${encodeURIComponent(query)}`);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHead title="Toko" sub="Semua usaha yang terdaftar." actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><Plus /> Buat toko</button>} />
      <form className="row" style={{ marginBottom: 16 }} onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }}>
        <div className="cust-search" style={{ flex: 1 }}>
          <Search aria-hidden="true" />
          <input className="input" placeholder="Cari nama toko atau email pemilik" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari toko" />
        </div>
        <button className="btn">Cari</button>
      </form>
      {error ? <ErrorState message={error.message} onRetry={() => reload()} /> : loading || !data ? <Loading rows={5} height={48} /> : data.tenants.length === 0 ? (
        <div className="panel"><Empty title="Tidak ada toko">{query ? "Tidak ada yang cocok dengan pencarian." : "Belum ada toko terdaftar."}</Empty></div>
      ) : (
        <div className="panel flush">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Toko</th><th>Paket</th><th>Status</th><th>Berakhir</th><th className="r">Pesanan 30 hr</th><th>Terakhir aktif</th></tr></thead>
              <tbody>
                {data.tenants.map((t) => {
                  const s = effectiveStatus(t);
                  return (
                    <tr key={t.id}>
                      <td>
                        <Link to={`/admin/toko/${t.id}`} className="strong">{t.name}</Link>
                        <div className="tiny muted">{KIND_LABEL[t.kind]} · {t.owner_login ?? "tanpa pemilik"}</div>
                      </td>
                      <td>{t.plan_name}</td>
                      <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                      <td className="nowrap small">{date(t.period_end)}</td>
                      <td className="r num">{number(t.orders_30d)}</td>
                      <td className="small muted nowrap">{t.last_order_at ? ago(t.last_order_at) : "Belum ada pesanan"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {creating && <CreateTenant onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload(true); }} />}
    </>
  );
}

function CreateTenant({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const plans = useApi<{ plans: Plan[] }>("/api/platform/plans");
  const [f, setF] = useState({ name: "", kind: "warung", plan_id: "", trial_days: 14, owner_name: "", owner_login: "", owner_password: "" });
  const [busy, setBusy] = useState(false);
  const planId = f.plan_id || plans.data?.plans.find((p) => p.active)?.id || "";
  return (
    <Modal
      open
      onClose={onClose}
      title="Buat toko baru"
      footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={busy || !planId} onClick={async () => {
        setBusy(true);
        try {
          await api.post("/api/platform/tenants", { ...f, plan_id: planId });
          toast(`${f.name} dibuat. Kirim login pemilik ke ${f.owner_name}.`);
          onDone();
        } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
      }}>Buat toko</button></>}
    >
      <div className="form-grid">
        <div className="form-row">
          <Field label="Nama toko" htmlFor="ct-name"><input id="ct-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Jenis" htmlFor="ct-kind">
            <select id="ct-kind" className="select" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Paket" htmlFor="ct-plan">
            <select id="ct-plan" className="select" value={planId} onChange={(e) => setF({ ...f, plan_id: e.target.value })}>
              {plans.data?.plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {rupiah(p.price_monthly)}</option>)}
            </select>
          </Field>
          <Field label="Masa coba (hari)" htmlFor="ct-trial"><input id="ct-trial" className="input num" inputMode="numeric" value={f.trial_days} onChange={(e) => setF({ ...f, trial_days: Number(e.target.value.replace(/\D/g, "") || 0) })} /></Field>
        </div>
        <Field label="Nama pemilik" htmlFor="ct-on"><input id="ct-on" className="input" value={f.owner_name} onChange={(e) => setF({ ...f, owner_name: e.target.value })} /></Field>
        <div className="form-row">
          <Field label="Email pemilik" htmlFor="ct-ol"><input id="ct-ol" className="input" value={f.owner_login} onChange={(e) => setF({ ...f, owner_login: e.target.value })} autoComplete="off" /></Field>
          <Field label="Kata sandi awal" htmlFor="ct-op" hint="Minimal 8 karakter. Minta pemilik menggantinya."><input id="ct-op" className="input" value={f.owner_password} onChange={(e) => setF({ ...f, owner_password: e.target.value })} autoComplete="new-password" /></Field>
        </div>
      </div>
    </Modal>
  );
}

interface TenantDetail {
  tenant: TenantRow & { plan_id: string; price_monthly: number; slug: string };
  users: { id: string; name: string; login: string; role: string; active: number; last_login_at: number | null }[];
  payments: { id: string; amount: number; months: number; method: string; note: string; created_at: number; period_end_after: number; plan_name: string }[];
  stats: { orders: number; gmv: number; items: number; tables: number };
}

export function AdminTenantDetail() {
  const { id = "" } = useParams();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<TenantDetail>(`/api/platform/tenants/${id}`);
  const plans = useApi<{ plans: Plan[] }>("/api/platform/plans");
  const [paying, setPaying] = useState(false);
  const [resetFor, setResetFor] = useState<{ id: string; name: string } | null>(null);
  const [pw, setPw] = useState("");
  if (error) return <ErrorState message={error.message} onRetry={() => reload()} />;
  if (loading || !data) return <Loading rows={4} height={80} />;
  const t = data.tenant;
  const s = effectiveStatus(t);

  return (
    <>
      <Link to="/admin/toko" className="btn btn-ghost btn-sm" style={{ marginBottom: 8 }}><ArrowLeft /> Semua toko</Link>
      <PageHead title={t.name} sub={<><span className={`badge ${s.cls}`}>{s.label}</span> · Paket {t.plan_name} sampai {date(t.period_end)}</>} actions={<button className="btn btn-primary" onClick={() => setPaying(true)}>Catat pembayaran</button>} />
      <div className="kpis" style={{ marginBottom: 20 }}>
        <div className="kpi"><span className="label">Nilai transaksi 30 hari</span><span className="value">{rupiah(data.stats.gmv)}</span></div>
        <div className="kpi"><span className="label">Pesanan 30 hari</span><span className="value">{number(data.stats.orders)}</span></div>
        <div className="kpi"><span className="label">Menu</span><span className="value">{number(data.stats.items)}</span></div>
        <div className="kpi"><span className="label">Meja</span><span className="value">{number(data.stats.tables)}</span></div>
      </div>
      <div className="grid-2">
        <TenantSubscriptionForm key={`${t.plan_id}-${t.status}-${t.period_end}`} tenant={t} plans={plans.data?.plans ?? []} onSaved={() => reload(true)} />
        <section className="panel">
          <div className="panel-head"><h2>Akun</h2></div>
          <div className="stack-sm">
            {data.users.map((u) => (
              <div key={u.id} className="row between" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                <span style={{ minWidth: 0 }}>
                  <span className="strong">{u.name}</span> <span className="badge">{ROLE_LABEL[u.role]}</span>
                  <div className="tiny muted">{u.login} · {u.last_login_at ? `masuk ${ago(u.last_login_at)}` : "belum pernah masuk"}</div>
                </span>
                <button className="btn btn-sm" onClick={() => { setResetFor(u); setPw(""); }}>Reset sandi</button>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel flush" style={{ marginTop: 20 }}>
        <div style={{ padding: "18px 18px 6px" }}><h2>Riwayat pembayaran</h2></div>
        {data.payments.length === 0 ? <Empty title="Belum ada pembayaran" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Tanggal</th><th>Paket</th><th>Cara</th><th>Aktif sampai</th><th className="r">Jumlah</th></tr></thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="small nowrap">{date(p.created_at)}</td>
                    <td>{p.plan_name} · {p.months} bln{p.note && <div className="tiny muted">{p.note}</div>}</td>
                    <td className="small">{p.method}</td>
                    <td className="small nowrap">{date(p.period_end_after)}</td>
                    <td className="r money">{rupiah(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {paying && <RecordPayment tenantId={t.id} currentPlan={t.plan_id} plans={plans.data?.plans ?? []} onClose={() => setPaying(false)} onDone={() => { setPaying(false); reload(true); }} />}
      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title={`Reset sandi ${resetFor?.name ?? ""}`} footer={<><button className="btn" onClick={() => setResetFor(null)}>Batal</button><button className="btn btn-primary" disabled={pw.length < 8} onClick={async () => {
        try {
          await api.post(`/api/platform/users/${resetFor!.id}/reset-password`, { password: pw });
          toast("Kata sandi diganti. Akun ini dikeluarkan dari semua perangkat.");
          setResetFor(null);
        } catch (e) { toast((e as Error).message, "error"); }
      }}>Ganti sandi</button></>}>
        <Field label="Kata sandi baru" htmlFor="rs-pw" hint="Minimal 8 karakter. Sampaikan ke pemilik akun lewat jalur pribadi.">
          <input id="rs-pw" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </Field>
      </Modal>
    </>
  );
}

function TenantSubscriptionForm({ tenant, plans, onSaved }: { tenant: TenantDetail["tenant"]; plans: Plan[]; onSaved: () => void }) {
  const toast = useToast();
  const [planId, setPlanId] = useState(tenant.plan_id);
  const [status, setStatus] = useState(tenant.status);
  const [end, setEnd] = useState(new Date(tenant.period_end).toISOString().slice(0, 10));
  return (
    <section className="panel">
      <div className="panel-head"><div><h2>Langganan</h2><p>Ubah manual kalau perlu koreksi. Untuk perpanjangan biasa, pakai Catat pembayaran.</p></div></div>
      <form className="form-grid" onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api.put(`/api/platform/tenants/${tenant.id}`, { plan_id: planId, status, period_end: Date.parse(`${end}T23:59:59+07:00`) });
          toast("Langganan disimpan.");
          onSaved();
        } catch (err) { toast((err as Error).message, "error"); }
      }}>
        <Field label="Paket" htmlFor="ts-plan">
          <select id="ts-plan" className="select" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <div className="form-row">
          <Field label="Status" htmlFor="ts-status">
            <select id="ts-status" className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Aktif sampai" htmlFor="ts-end"><input id="ts-end" type="date" className="input" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        <div className="form-actions"><button className="btn">Simpan langganan</button></div>
      </form>
    </section>
  );
}

function RecordPayment({ tenantId, currentPlan, plans, onClose, onDone }: { tenantId: string; currentPlan: string; plans: Plan[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [planId, setPlanId] = useState(currentPlan);
  const [months, setMonths] = useState(1);
  const plan = plans.find((p) => p.id === planId);
  const [amount, setAmount] = useState<number | "">(plan ? plan.price_monthly : "");
  const [method, setMethod] = useState("transfer");
  const [note, setNote] = useState("");
  return (
    <Modal open onClose={onClose} title="Catat pembayaran langganan" footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={amount === ""} onClick={async () => {
      try {
        const r = await api.post<{ period_end: number }>(`/api/platform/tenants/${tenantId}/payments`, { plan_id: planId, months, amount, method, note });
        toast(`Tercatat. Aktif sampai ${date(r.period_end)}.`);
        onDone();
      } catch (e) { toast((e as Error).message, "error"); }
    }}>Simpan & perpanjang</button></>}>
      <div className="form-grid">
        <div className="form-row">
          <Field label="Paket" htmlFor="rp-plan">
            <select id="rp-plan" className="select" value={planId} onChange={(e) => { setPlanId(e.target.value); const p = plans.find((x) => x.id === e.target.value); if (p) setAmount(p.price_monthly * months); }}>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {rupiah(p.price_monthly)}/bln</option>)}
            </select>
          </Field>
          <Field label="Berapa bulan" htmlFor="rp-months">
            <select id="rp-months" className="select" value={months} onChange={(e) => { const m = Number(e.target.value); setMonths(m); if (plan) setAmount(plan.price_monthly * m); }}>
              {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} bulan</option>)}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Jumlah diterima" htmlFor="rp-amt"><MoneyInput id="rp-amt" value={amount} onChange={setAmount} /></Field>
          <Field label="Cara bayar" htmlFor="rp-method"><input id="rp-method" className="input" value={method} onChange={(e) => setMethod(e.target.value)} maxLength={30} /></Field>
        </div>
        <Field label="Catatan" htmlFor="rp-note"><input id="rp-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Mis. transfer BCA, ref 8812" /></Field>
        <p className="small muted">Masa aktif diperpanjang dari tanggal berakhir sekarang (atau dari hari ini kalau sudah lewat / masih masa coba).</p>
      </div>
    </Modal>
  );
}

export function AdminPlans() {
  const { data, error, loading, reload } = useApi<{ plans: Plan[] }>("/api/platform/plans");
  const [edit, setEdit] = useState<Partial<Plan> | null>(null);
  return (
    <>
      <PageHead title="Paket langganan" sub="Batasan tiap paket berlaku langsung untuk semua toko di paket itu." actions={<button className="btn btn-primary" onClick={() => setEdit({ active: 1, allow_inventory: 1, allow_analytics: 1, allow_video: 0, max_tables: 10, max_staff: 3, price_monthly: 0, sort: (data?.plans.length ?? 0) + 1 })}><Plus /> Paket baru</button>} />
      {error ? <ErrorState message={error.message} onRetry={() => reload()} /> : loading || !data ? <Loading rows={3} height={48} /> : (
        <div className="panel flush">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Paket</th><th className="r">Harga/bln</th><th className="r">Meja</th><th className="r">Karyawan</th><th>Video</th><th>Stok</th><th>Laporan</th><th className="r">Toko</th><th></th></tr></thead>
              <tbody>
                {data.plans.map((p) => (
                  <tr key={p.id} style={!p.active ? { opacity: 0.6 } : undefined}>
                    <td><span className="strong">{p.name}</span> <span className="tiny muted">{p.code}</span>{!p.active && <span className="badge" style={{ marginLeft: 6 }}>Disembunyikan</span>}</td>
                    <td className="r money">{rupiah(p.price_monthly)}</td>
                    <td className="r num">{p.max_tables}</td>
                    <td className="r num">{p.max_staff}</td>
                    <td>{p.allow_video ? "Ya" : "Tidak"}</td>
                    <td>{p.allow_inventory ? "Ya" : "Tidak"}</td>
                    <td>{p.allow_analytics ? "Ya" : "Tidak"}</td>
                    <td className="r num">{p.tenant_count}</td>
                    <td className="r"><button className="btn btn-sm" onClick={() => setEdit(p)}>Ubah</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {edit && <PlanEditor plan={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(true); }} />}
    </>
  );
}

function PlanEditor({ plan, onClose, onDone }: { plan: Partial<Plan>; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    code: plan.code ?? "", name: plan.name ?? "", price_monthly: (plan.price_monthly ?? 0) as number | "",
    max_tables: plan.max_tables ?? 10, max_staff: plan.max_staff ?? 3, allow_video: !!plan.allow_video,
    allow_inventory: !!plan.allow_inventory, allow_analytics: !!plan.allow_analytics, active: plan.active !== 0, sort: plan.sort ?? 0,
  });
  const num = (v: string) => Number(v.replace(/\D/g, "") || 0);
  return (
    <Modal open onClose={onClose} title={plan.id ? `Ubah paket ${plan.name}` : "Paket baru"} footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" onClick={async () => {
      try {
        const body = { ...f, price_monthly: Number(f.price_monthly || 0) };
        if (plan.id) await api.put(`/api/platform/plans/${plan.id}`, body);
        else await api.post("/api/platform/plans", body);
        toast("Paket disimpan.");
        onDone();
      } catch (e) { toast((e as Error).message, "error"); }
    }}>Simpan</button></>}>
      <div className="form-grid">
        <div className="form-row">
          <Field label="Nama" htmlFor="pl-name"><input id="pl-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Kode" htmlFor="pl-code" hint="Huruf kecil, mis. kafe"><input id="pl-code" className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toLowerCase() })} /></Field>
        </div>
        <div className="form-row">
          <Field label="Harga per bulan" htmlFor="pl-price"><MoneyInput id="pl-price" value={f.price_monthly} onChange={(v) => setF({ ...f, price_monthly: v })} /></Field>
          <Field label="Urutan" htmlFor="pl-sort"><input id="pl-sort" className="input num" value={f.sort} onChange={(e) => setF({ ...f, sort: num(e.target.value) })} /></Field>
        </div>
        <div className="form-row">
          <Field label="Maks. meja" htmlFor="pl-tables"><input id="pl-tables" className="input num" value={f.max_tables} onChange={(e) => setF({ ...f, max_tables: num(e.target.value) })} /></Field>
          <Field label="Maks. akun karyawan" htmlFor="pl-staff"><input id="pl-staff" className="input num" value={f.max_staff} onChange={(e) => setF({ ...f, max_staff: num(e.target.value) })} /></Field>
        </div>
        <Switch checked={f.allow_video} onChange={(v) => setF({ ...f, allow_video: v })} label="Boleh unggah video menu" hint="Video memakan penyimpanan & bandwidth paling besar." />
        <Switch checked={f.allow_inventory} onChange={(v) => setF({ ...f, allow_inventory: v })} label="Fitur stok" />
        <Switch checked={f.allow_analytics} onChange={(v) => setF({ ...f, allow_analytics: v })} label="Laporan analitik" />
        <Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Tampil untuk pendaftar baru" hint="Paket yang disembunyikan tetap berlaku untuk toko yang sudah memakainya." />
      </div>
    </Modal>
  );
}
