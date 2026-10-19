import { useEffect, useState } from "react";
import { Field, Loading, PageHead, Switch, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { date, KIND_LABEL, rupiah } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { useSession } from "../../lib/session";

interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  max_tables: number;
  max_staff: number;
  allow_video: number;
  allow_inventory: number;
  allow_analytics: number;
  allow_branding: number;
  max_photos: number;
  max_videos: number;
}

export function SettingsPage() {
  const { tenant, refresh } = useSession();
  const toast = useToast();
  const sub = useApi<{ plans: Plan[]; payments: { amount: number; months: number; created_at: number; plan_name: string }[] }>("/api/store/subscription");
  const [f, setF] = useState(() => tenant && {
    name: tenant.name,
    kind: tenant.kind,
    address: tenant.address,
    phone: tenant.phone,
    welcome_note: tenant.welcome_note,
    welcome_note_en: tenant.welcome_note_en ?? "",
    tax_rate: tenant.tax_rate,
    service_rate: tenant.service_rate,
    inventory_enabled: !!tenant.inventory_enabled,
    qr_ordering_enabled: !!tenant.qr_ordering_enabled,
    logo_url: tenant.logo_url,
    google_review_url: tenant.google_review_url ?? "",
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!f && tenant) setF({ ...tenant, inventory_enabled: !!tenant.inventory_enabled, qr_ordering_enabled: !!tenant.qr_ordering_enabled, google_review_url: tenant.google_review_url ?? "" });
  }, [tenant, f]);
  if (!tenant || !f) return <Loading />;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put("/api/store/settings", f);
      await refresh();
      toast("Pengaturan disimpan.");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const pct = (v: string) => Math.min(30, Math.max(0, Number(v.replace(",", ".").replace(/[^\d.]/g, "")) || 0));
  const statusLabel = { trial: "Masa coba", active: "Aktif", past_due: "Menunggu pembayaran", suspended: "Dinonaktifkan" }[tenant.status];

  return (
    <>
      <PageHead title="Pengaturan" sub="Info toko yang tampil di menu pelanggan, pajak, dan fitur yang dipakai." />
      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 820 }}>
        <form className="stack" style={{ gap: 20 }} onSubmit={save}>
          <section className="panel">
            <div className="panel-head"><h2>Info toko</h2></div>
            <div className="form-grid">
              <div className="form-row">
                <Field label="Nama usaha" htmlFor="s-name">
                  <input id="s-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} required />
                </Field>
                <Field label="Jenis usaha" htmlFor="s-kind">
                  <select id="s-kind" className="select" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                    {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
              </div>
              <div className="form-row">
                <Field label="Alamat" htmlFor="s-addr" hint="Tampil di struk dan menu pelanggan.">
                  <input id="s-addr" className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} maxLength={200} />
                </Field>
                <Field label="No. WhatsApp / telepon" htmlFor="s-phone">
                  <input id="s-phone" className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} maxLength={30} />
                </Field>
              </div>
              <Field label="Sapaan di menu pelanggan" htmlFor="s-note" hint="Mis. jam buka, cara bayar, atau info Wi-Fi.">
                <textarea id="s-note" className="textarea" value={f.welcome_note} onChange={(e) => setF({ ...f, welcome_note: e.target.value })} maxLength={240} placeholder="Pesan dari meja, bayar di kasir setelah makan." />
              </Field>
              <Field label="Sapaan dalam bahasa Inggris (opsional)" htmlFor="s-note-en" hint="Untuk pembeli yang memilih bahasa EN di menu.">
                <textarea id="s-note-en" className="textarea" lang="en" value={f.welcome_note_en} onChange={(e) => setF({ ...f, welcome_note_en: e.target.value })} maxLength={240} placeholder="Order from your table, pay at the cashier after your meal." />
              </Field>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Pajak & service</h2>
                <p>Isi 0 kalau tidak dipungut. Service dihitung dari subtotal, pajak dari subtotal + service.</p>
              </div>
            </div>
            <div className="form-row">
              <Field label="Pajak (PB1) %" htmlFor="s-tax">
                <input id="s-tax" className="input num" inputMode="decimal" value={f.tax_rate} onChange={(e) => setF({ ...f, tax_rate: pct(e.target.value) })} />
              </Field>
              <Field label="Service %" htmlFor="s-svc">
                <input id="s-svc" className="input num" inputMode="decimal" value={f.service_rate} onChange={(e) => setF({ ...f, service_rate: pct(e.target.value) })} />
              </Field>
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>
              Contoh pesanan {rupiah(50000)}: service {rupiah(Math.round(50000 * f.service_rate / 100))}, pajak {rupiah(Math.round((50000 + Math.round(50000 * f.service_rate / 100)) * f.tax_rate / 100))}, total{" "}
              <span className="strong">{rupiah(50000 + Math.round(50000 * f.service_rate / 100) + Math.round((50000 + Math.round(50000 * f.service_rate / 100)) * f.tax_rate / 100))}</span>.
            </p>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Fitur</h2></div>
            <div className="stack">
              <Switch
                checked={f.qr_ordering_enabled}
                onChange={(v) => setF({ ...f, qr_ordering_enabled: v })}
                label="Pelanggan bisa pesan lewat QR meja"
                hint="Kalau dimatikan, QR hanya menampilkan menu (seperti buku menu digital). Pesanan tetap dicatat di kasir."
              />
              <Switch
                checked={f.inventory_enabled}
                disabled={!tenant.allow_inventory}
                onChange={(v) => setF({ ...f, inventory_enabled: v })}
                label="Catat stok barang"
                hint={tenant.allow_inventory ? "Opsional. Nyalakan kalau kamu ingin stok berkurang otomatis tiap terjual dan diingatkan saat menipis." : `Belum termasuk di paket ${tenant.plan_name}.`}
              />
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h2>Ulasan Google Maps</h2>
                <p>Setelah pembeli memberi nilai dari HP-nya, tombol "Tulis ulasan di Google Maps" ditampilkan ke semua pembeli, apa pun nilainya. Google melarang hanya meminta ulasan dari pembeli yang puas.</p>
              </div>
            </div>
            <Field label="Tautan menulis ulasan" htmlFor="s-review" hint='Di Google Business Profile: "Minta ulasan" lalu salin tautannya (diawali https://g.page/ atau https://maps.app.goo.gl/). Kosongkan kalau belum punya.'>
              <input id="s-review" className="input" inputMode="url" value={f.google_review_url} onChange={(e) => setF({ ...f, google_review_url: e.target.value.trim() })} maxLength={300} placeholder="https://g.page/r/..." />
            </Field>
          </section>

          <div className="form-actions">
            <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
              {busy ? "Menyimpan..." : "Simpan pengaturan"}
            </button>
          </div>
        </form>

        <section className="panel" aria-labelledby="sub-title" style={{ marginTop: 8 }}>
          <div className="panel-head">
            <div>
              <h2 id="sub-title">Langganan</h2>
              <p>
                Paket {tenant.plan_name} · {statusLabel} sampai {date(tenant.period_end)}
              </p>
            </div>
          </div>
          {sub.loading ? (
            <Loading rows={2} height={40} />
          ) : sub.error ? (
            <p className="small" style={{ color: "var(--danger)" }}>{sub.error.message}</p>
          ) : (
            <div className="stack">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Paket</th><th className="r">Per bulan</th><th className="r">Meja</th><th className="r">Akun karyawan</th><th>Galeri per menu</th><th>Tampilan kustom</th></tr>
                  </thead>
                  <tbody>
                    {sub.data?.plans.map((p) => (
                      <tr key={p.id} style={p.name === tenant.plan_name ? { background: "var(--brand-soft)" } : undefined}>
                        <td className="strong">{p.name}{p.name === tenant.plan_name && <span className="small muted"> (paket kamu)</span>}</td>
                        <td className="r money">{rupiah(p.price_monthly)}</td>
                        <td className="r num">{p.max_tables}</td>
                        <td className="r num">{p.max_staff}</td>
                        <td className="nowrap">{p.max_photos} foto{p.allow_video && p.max_videos ? ` + ${p.max_videos} video` : ""}</td>
                        <td>{p.allow_branding ? "Ya" : "Template"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small muted">
                Untuk ganti paket atau memperpanjang, hubungi admin Pesan.in. Pembayaran otomatis lewat aplikasi belum tersedia.
              </p>
              {!!sub.data?.payments.length && (
                <div>
                  <h3 style={{ marginBottom: 6 }}>Riwayat pembayaran</h3>
                  {sub.data.payments.map((p, i) => (
                    <div key={i} className="row between small" style={{ padding: "6px 0", borderTop: "1px solid var(--line)" }}>
                      <span>{date(p.created_at)} · {p.plan_name} {p.months} bulan</span>
                      <span className="money strong">{rupiah(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export function AccountPage() {
  const { user } = useSession();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHead title="Akun saya" sub={`${user?.name} · ${user?.login}`} />
      <form
        className="panel form-grid"
        style={{ maxWidth: 480 }}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.post("/api/auth/password", { current, next });
            toast("Kata sandi diganti.");
            setCurrent("");
            setNext("");
          } catch (err) {
            toast((err as Error).message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Ganti kata sandi</h2>
        <Field label="Kata sandi sekarang" htmlFor="pw-cur">
          <input id="pw-cur" className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </Field>
        <Field label="Kata sandi baru" htmlFor="pw-new" hint="Minimal 8 karakter.">
          <input id="pw-new" className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required />
        </Field>
        <div className="form-actions">
          <button className="btn btn-primary" disabled={busy || next.length < 8}>Ganti kata sandi</button>
        </div>
      </form>
    </>
  );
}
