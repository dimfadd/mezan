import { useEffect, useState } from "react";
import { Search, Stamp } from "lucide-react";
import { Empty, ErrorState, Field, Loading, MoneyInput, PageHead, Switch, useToast } from "../../components/ui";
import { StampDots } from "../../components/PaymentModal";
import { api } from "../../lib/api";
import { ago, number, rupiah } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { useSession } from "../../lib/session";

interface Member {
  phone: string;
  name: string;
  stamps: number;
  total_stamps: number;
  rewards: number;
  created_at: number;
  last_visit_at: number | null;
}
interface Data {
  settings: { enabled: boolean; target: number; min_spend: number; reward: string };
  members: Member[];
  stats: { members: number; ready: number; rewards: number };
}

const showPhone = (p: string) => `0${p.slice(2)}`.replace(/(\d{4})(\d{4})(\d+)/, "$1 $2 $3");

export function LoyaltyPage() {
  const { refresh } = useSession();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, error, loading, reload } = useApi<Data>(`/api/store/loyalty?q=${encodeURIComponent(query)}`);
  const [f, setF] = useState<{ enabled: boolean; target: number; min_spend: number | ""; reward: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data && !f) setF({ ...data.settings });
  }, [data, f]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f) return;
    setBusy(true);
    try {
      await api.put("/api/store/loyalty", { ...f, min_spend: f.min_spend === "" ? 0 : f.min_spend });
      await refresh();
      reload(true);
      toast(f.enabled ? "Kartu stempel aktif. Kasir akan melihat kolom No. HP saat menerima bayar." : "Pengaturan disimpan.");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="Kartu stempel" sub="Pelanggan cukup menyebut nomor HP saat bayar. Tidak perlu aplikasi atau kartu fisik." />
      {error && !data ? (
        <ErrorState message={error.message} onRetry={() => reload()} />
      ) : !data || !f ? (
        <Loading rows={2} height={120} />
      ) : (
        <div className="stack" style={{ gap: 20 }}>
          <div className="grid-2">
            <form className="panel stack" onSubmit={save}>
              <Switch checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label="Pakai kartu stempel" hint="Satu pesanan yang dibayar = satu stempel. Pembeli QR bisa mengambil stempelnya sendiri dari halaman pesanan setelah bayar." />
              <div className="form-row">
                <Field label="Jumlah stempel untuk hadiah" htmlFor="ly-target">
                  <input id="ly-target" className="input num" inputMode="numeric" value={f.target} onChange={(e) => setF({ ...f, target: Math.min(50, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
                </Field>
                <Field label="Minimal belanja per stempel" htmlFor="ly-min" hint="0 = setiap pesanan dapat stempel.">
                  <MoneyInput id="ly-min" value={f.min_spend} onChange={(v) => setF({ ...f, min_spend: v })} />
                </Field>
              </div>
              <Field label="Hadiahnya" htmlFor="ly-reward" hint="Ditulis seperti yang dibaca pelanggan.">
                <input id="ly-reward" className="input" value={f.reward} onChange={(e) => setF({ ...f, reward: e.target.value })} maxLength={80} placeholder="Mis. 1 Es Teh Manis gratis" />
              </Field>
              <button className="btn btn-primary" disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</button>
            </form>
            <section className="panel stack">
              <h2>Contoh yang dilihat pelanggan</h2>
              <div className="stamp-preview">
                <span className="small strong"><Stamp aria-hidden="true" className="inline-ico" /> {f.target} stempel = {f.reward || "hadiah"}</span>
                <StampDots n={Math.min(3, f.target)} of={f.target} />
                <span className="tiny muted">3 dari {f.target} stempel{f.min_spend ? ` · belanja minimal ${rupiah(Number(f.min_spend))}` : ""}</span>
              </div>
              <div className="kpis" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                <div className="kpi"><span className="label">Pelanggan</span><span className="value">{number(data.stats.members)}</span></div>
                <div className="kpi"><span className="label">Siap tukar</span><span className="value">{number(data.stats.ready)}</span></div>
                <div className="kpi"><span className="label">Hadiah ditukar</span><span className="value">{number(data.stats.rewards)}</span></div>
              </div>
            </section>
          </div>

          <section className="panel flush" aria-labelledby="ly-members">
            <div className="row between wrap" style={{ padding: "16px 18px 8px", gap: 10 }}>
              <h2 id="ly-members">Pelanggan</h2>
              <form className="cust-search" style={{ flex: "0 1 280px" }} onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }}>
                <Search aria-hidden="true" />
                <input className="input" placeholder="Cari nama atau nomor" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => setQuery(q.trim())} aria-label="Cari pelanggan" />
              </form>
            </div>
            {loading ? (
              <div style={{ padding: 16 }}><Loading rows={3} height={40} /></div>
            ) : data.members.length === 0 ? (
              <Empty icon={<Stamp aria-hidden="true" />} title={query ? "Tidak ditemukan" : "Belum ada pelanggan"}>
                {query ? "Coba nomor tanpa 0 di depan, atau sebagian nama." : "Kartu dibuat otomatis saat kasir memasukkan nomor HP pelanggan waktu bayar."}
              </Empty>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Pelanggan</th><th>Stempel</th><th className="r">Total kunjungan bersetempel</th><th className="r">Hadiah</th><th>Terakhir datang</th></tr>
                  </thead>
                  <tbody>
                    {data.members.map((m) => (
                      <tr key={m.phone}>
                        <td>
                          <div className="strong">{m.name || "Tanpa nama"}</div>
                          <div className="tiny muted num">{showPhone(m.phone)}</div>
                        </td>
                        <td>
                          <div className="row" style={{ gap: 8 }}>
                            <StampDots n={Math.min(m.stamps, data.settings.target)} of={data.settings.target} />
                            <span className="small num">{m.stamps}/{data.settings.target}</span>
                            {m.stamps >= data.settings.target && <span className="badge badge-ok">Siap tukar</span>}
                          </div>
                        </td>
                        <td className="r num">{m.total_stamps}</td>
                        <td className="r num">{m.rewards}</td>
                        <td className="small muted">{m.last_visit_at ? ago(m.last_visit_at) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
