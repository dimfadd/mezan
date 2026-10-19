import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, LockKeyhole, Wallet } from "lucide-react";
import { Empty, ErrorState, Field, Loading, Modal, MoneyInput, PageHead, Segmented, useConfirm, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { dateTime, PAY_LABEL, rupiah, time } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { isManagement, useSession } from "../../lib/session";
import { useOrderFeed } from "../../components/Shell";

interface Shift {
  id: string;
  status: "open" | "closed";
  opened_at: number;
  opening_cash: number;
  closed_at: number | null;
  expected_cash: number | null;
  counted_cash: number | null;
  note: string;
  opened_by_name: string | null;
  closed_by_name: string | null;
}
interface Summary {
  byMethod: { method: string; orders: number; total: number }[];
  moves: { id: string; kind: "in" | "out"; amount: number; note: string; created_at: number; user_name: string | null }[];
  cash_sales: number;
  cash_in: number;
  cash_out: number;
  expected: number;
  sales_total: number;
  orders: number;
}

export function Diff({ value }: { value: number }) {
  if (value === 0) return <span className="badge badge-ok">Pas</span>;
  return value < 0 ? <span className="badge badge-danger">Kurang {rupiah(-value)}</span> : <span className="badge badge-warn">Lebih {rupiah(value)}</span>;
}

export function CashPage() {
  const { user } = useSession();
  const cur = useApi<{ shift: Shift | null; summary: Summary | null; last: Shift | null }>("/api/store/shifts/current", { poll: 20000 });
  const mgmt = isManagement(user?.role);
  return (
    <>
      <PageHead title="Kas & shift" sub="Buka shift dengan modal awal, catat uang keluar-masuk laci, lalu hitung uangnya saat tutup. Selisihnya langsung kelihatan." />
      {cur.error && !cur.data ? (
        <ErrorState message={cur.error.message} onRetry={() => cur.reload()} />
      ) : !cur.data ? (
        <Loading rows={2} height={140} />
      ) : cur.data.shift && cur.data.summary ? (
        <OpenShift shift={cur.data.shift} sum={cur.data.summary} onChanged={() => cur.reload(true)} />
      ) : (
        <OpenForm last={cur.data.last} onOpened={() => cur.reload(true)} />
      )}
      {mgmt && <History />}
    </>
  );
}

function OpenForm({ last, onOpened }: { last: Shift | null; onOpened: () => void }) {
  const toast = useToast();
  const feed = useOrderFeed();
  const [cash, setCash] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid-2">
      <form
        className="panel stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.post("/api/store/shifts/open", { opening_cash: cash === "" ? 0 : cash });
            toast("Shift dibuka. Selamat bekerja.");
            onOpened();
            feed.reload();
          } catch (err) {
            toast((err as Error).message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2><Wallet aria-hidden="true" className="h-ico" /> Buka shift</h2>
        <Field label="Modal awal di laci" htmlFor="sh-open" hint="Uang kembalian yang ada di laci sebelum mulai jualan. Tulis 0 kalau kosong.">
          <MoneyInput id="sh-open" value={cash} onChange={setCash} />
        </Field>
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Membuka..." : "Buka shift"}</button>
      </form>
      <section className="panel stack">
        <h2>Shift terakhir</h2>
        {last ? (
          <>
            <p className="small muted">
              {dateTime(last.opened_at)} sampai {last.closed_at ? time(last.closed_at) : "-"} · {last.opened_by_name ?? "-"}
              {last.closed_by_name && last.closed_by_name !== last.opened_by_name ? `, ditutup ${last.closed_by_name}` : ""}
            </p>
            <div className="sum-row"><span>Seharusnya di laci</span><span className="money">{rupiah(last.expected_cash)}</span></div>
            <div className="sum-row"><span>Dihitung</span><span className="money">{rupiah(last.counted_cash)}</span></div>
            <div className="sum-row"><span>Selisih</span><Diff value={(last.counted_cash ?? 0) - (last.expected_cash ?? 0)} /></div>
          </>
        ) : (
          <p className="muted small">Belum ada shift. Mulai dari modal awal hari ini.</p>
        )}
      </section>
    </div>
  );
}

function OpenShift({ shift, sum, onChanged }: { shift: Shift; sum: Summary; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const feed = useOrderFeed();
  const [kind, setKind] = useState<"out" | "in">("out");
  const [amount, setAmount] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [counted, setCounted] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ expected: number; counted: number; diff: number } | null>(null);
  const nonCash = sum.byMethod.filter((m) => m.method !== "cash");

  const addMove = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/api/store/shifts/${shift.id}/moves`, { kind, amount: amount === "" ? 0 : amount, note });
      setAmount("");
      setNote("");
      toast(kind === "out" ? "Uang keluar dicatat." : "Uang masuk dicatat.");
      onChanged();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const close = async () => {
    if (counted === "") return toast("Hitung dulu uang di laci, lalu isi jumlahnya.", "error");
    const diff = counted - sum.expected;
    if (!(await confirm({ title: "Tutup shift?", body: `Uang dihitung ${rupiah(counted)}, seharusnya ${rupiah(sum.expected)}. ${diff === 0 ? "Pas." : diff < 0 ? `Kurang ${rupiah(-diff)}.` : `Lebih ${rupiah(diff)}.`} Setelah ditutup, angka ini tidak bisa diubah.`, confirm: "Tutup shift" }))) return;
    setBusy(true);
    try {
      const r = await api.post<{ expected: number; counted: number; diff: number }>(`/api/store/shifts/${shift.id}/close`, { counted_cash: counted });
      setResult(r);
      feed.reload();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <p className="small muted">Shift dibuka {dateTime(shift.opened_at)} oleh {shift.opened_by_name ?? "-"}. Angka di bawah diperbarui otomatis.</p>
      <div className="kpis">
        <div className="kpi hero">
          <span className="label">Seharusnya di laci</span>
          <span className="value">{rupiah(sum.expected)}</span>
          <span className="delta">modal + tunai + masuk − keluar</span>
        </div>
        <div className="kpi"><span className="label">Modal awal</span><span className="value">{rupiah(shift.opening_cash)}</span></div>
        <div className="kpi"><span className="label">Penjualan tunai</span><span className="value">{rupiah(sum.cash_sales)}</span></div>
        <div className="kpi">
          <span className="label">Uang keluar / masuk</span>
          <span className="value">{rupiah(sum.cash_out)}</span>
          <span className="delta">masuk {rupiah(sum.cash_in)}</span>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel stack">
          <h2>Uang keluar atau masuk laci</h2>
          <form className="stack" onSubmit={addMove}>
            <Segmented label="Jenis" value={kind} onChange={setKind} options={[{ value: "out", label: "Uang keluar" }, { value: "in", label: "Uang masuk" }]} />
            <div className="form-row">
              <Field label="Jumlah" htmlFor="mv-amt"><MoneyInput id="mv-amt" value={amount} onChange={setAmount} /></Field>
              <Field label="Keterangan" htmlFor="mv-note">
                <input id="mv-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder={kind === "out" ? "Mis. beli es batu, setor ke pemilik" : "Mis. tambah uang kembalian"} />
              </Field>
            </div>
            <button className="btn" disabled={busy || amount === "" || !note.trim()}>Catat</button>
          </form>
          {sum.moves.length > 0 && (
            <ul className="move-list">
              {sum.moves.map((m) => (
                <li key={m.id}>
                  {m.kind === "out" ? <ArrowUpRight aria-hidden="true" className="out" /> : <ArrowDownLeft aria-hidden="true" className="in" />}
                  <span>
                    {m.note}
                    <span className="tiny muted"> · {time(m.created_at)}{m.user_name ? ` · ${m.user_name}` : ""}</span>
                  </span>
                  <span className={`money strong ${m.kind}`}>{m.kind === "out" ? "−" : "+"}{rupiah(m.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel stack">
          <h2><LockKeyhole aria-hidden="true" className="h-ico" /> Tutup shift</h2>
          {nonCash.length > 0 && (
            <div className="stack-sm">
              <span className="small muted">Bukan tunai (tidak masuk laci, cocokkan dengan mutasi/aplikasi):</span>
              {nonCash.map((m) => (
                <div className="sum-row small" key={m.method}><span>{PAY_LABEL[m.method] ?? m.method} · {m.orders}x</span><span className="money">{rupiah(m.total)}</span></div>
              ))}
            </div>
          )}
          <Field label="Uang di laci setelah dihitung" htmlFor="sh-count">
            <MoneyInput id="sh-count" value={counted} onChange={setCounted} />
          </Field>
          {counted !== "" && (
            <div className="sum-row"><span>Selisih</span><Diff value={counted - sum.expected} /></div>
          )}
          <button className="btn btn-primary btn-lg" disabled={busy} onClick={close}>Tutup shift</button>
        </section>
      </div>

      <Modal
        open={!!result}
        onClose={() => { setResult(null); onChanged(); }}
        title="Shift ditutup"
        footer={<button className="btn btn-primary" onClick={() => { setResult(null); onChanged(); }}>Selesai</button>}
      >
        {result && (
          <div className="stack">
            <div className="sum-row"><span>Seharusnya</span><span className="money">{rupiah(result.expected)}</span></div>
            <div className="sum-row"><span>Dihitung</span><span className="money">{rupiah(result.counted)}</span></div>
            <div className="sum-row total"><span>Selisih</span><Diff value={result.diff} /></div>
            {result.diff !== 0 && <p className="small muted">Cek lagi pesanan tunai yang belum ditandai lunas atau uang keluar yang lupa dicatat. Pemilik bisa melihat riwayat ini.</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

function History() {
  const { data, error, loading, reload } = useApi<{ shifts: Shift[] }>("/api/store/shifts");
  const [open, setOpen] = useState<Shift | null>(null);
  const detail = useApi<{ shift: Shift; summary: Summary }>(open ? `/api/store/shifts/${open.id}` : null);
  return (
    <section className="panel flush" style={{ marginTop: 24 }} aria-labelledby="sh-hist">
      <div style={{ padding: "16px 18px 6px" }}>
        <h2 id="sh-hist">Riwayat shift</h2>
        <p className="small muted">Hanya terlihat oleh pemilik dan manajer.</p>
      </div>
      {error ? (
        <div style={{ padding: 16 }}><ErrorState message={error.message} onRetry={() => reload()} /></div>
      ) : loading || !data ? (
        <div style={{ padding: 16 }}><Loading rows={3} height={40} /></div>
      ) : data.shifts.length === 0 ? (
        <Empty title="Belum ada shift yang ditutup" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Shift</th><th>Dijaga</th><th className="r">Seharusnya</th><th className="r">Dihitung</th><th>Selisih</th></tr>
            </thead>
            <tbody>
              {data.shifts.map((s) => (
                <tr key={s.id}>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setOpen(s)}>{dateTime(s.opened_at)}–{s.closed_at ? time(s.closed_at) : ""}</button>
                  </td>
                  <td>{s.opened_by_name ?? "-"}{s.closed_by_name && s.closed_by_name !== s.opened_by_name ? ` → ${s.closed_by_name}` : ""}</td>
                  <td className="r money">{rupiah(s.expected_cash)}</td>
                  <td className="r money">{rupiah(s.counted_cash)}</td>
                  <td><Diff value={(s.counted_cash ?? 0) - (s.expected_cash ?? 0)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `Shift ${dateTime(open.opened_at)}` : ""}>
        {detail.data ? (
          <div className="stack">
            <div className="sum-row"><span>Modal awal</span><span className="money">{rupiah(detail.data.shift.opening_cash)}</span></div>
            {detail.data.summary.byMethod.map((m) => (
              <div className="sum-row small" key={m.method}><span>{PAY_LABEL[m.method] ?? m.method} · {m.orders}x</span><span className="money">{rupiah(m.total)}</span></div>
            ))}
            {detail.data.summary.moves.map((m) => (
              <div className="sum-row small" key={m.id}><span>{m.kind === "out" ? "Keluar" : "Masuk"}: {m.note}{m.user_name ? ` (${m.user_name})` : ""}</span><span className="money">{m.kind === "out" ? "−" : "+"}{rupiah(m.amount)}</span></div>
            ))}
            <hr className="divider-dashed" />
            <div className="sum-row"><span>Seharusnya</span><span className="money">{rupiah(detail.data.shift.expected_cash)}</span></div>
            <div className="sum-row"><span>Dihitung</span><span className="money">{rupiah(detail.data.shift.counted_cash)}</span></div>
            <div className="sum-row total"><span>Selisih</span><Diff value={(detail.data.shift.counted_cash ?? 0) - (detail.data.shift.expected_cash ?? 0)} /></div>
            <p className="tiny muted">Angka penjualan di atas dihitung ulang dari pesanan; "Seharusnya" adalah angka saat shift ditutup.</p>
          </div>
        ) : (
          <Loading rows={3} height={30} />
        )}
      </Modal>
    </section>
  );
}
