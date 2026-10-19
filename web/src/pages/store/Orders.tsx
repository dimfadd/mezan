import { useState } from "react";
import { Bell, BellOff, Printer, QrCode, Search, ShoppingBasket } from "lucide-react";
import { useOrderFeed, soundEnabled } from "../../components/Shell";
import { Empty, ErrorState, Loading, Modal, PageHead, Segmented, useConfirm, useToast } from "../../components/ui";
import { PaymentModal } from "../../components/PaymentModal";
import { printReceipt } from "../../components/receipt";
import { api } from "../../lib/api";
import { ago, PAY_LABEL, rupiah, time } from "../../lib/format";
import { useApi, useMediaQuery } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { STATUS_LABEL, type Order } from "./types";

type Col = "new" | "preparing" | "ready";

function columnOf(o: Order): Col {
  if (o.status === "new") return "new";
  if (o.status === "preparing") return "preparing";
  return "ready"; // siap diantar, atau sudah diantar tapi belum bayar
}

const COLS: { key: Col; title: string; empty: string }[] = [
  { key: "new", title: "Baru masuk", empty: "Pesanan dari QR meja akan muncul di sini." },
  { key: "preparing", title: "Sedang dibuat", empty: "Belum ada yang sedang dibuat." },
  { key: "ready", title: "Siap / belum bayar", empty: "Tidak ada yang menunggu diantar atau dibayar." },
];

export function OrdersPage() {
  const [tab, setTab] = useState<"active" | "history">("active");
  const [sound, setSound] = useState(soundEnabled());
  return (
    <>
      <PageHead
        title="Pesanan"
        sub={tab === "active" ? "Diperbarui otomatis tiap beberapa detik." : "Semua pesanan per tanggal."}
        actions={
          <>
            <Segmented
              label="Tampilan"
              value={tab}
              onChange={setTab}
              options={[
                { value: "active", label: "Berjalan" },
                { value: "history", label: "Riwayat" },
              ]}
            />
            <button
              className="icon-btn"
              aria-label={sound ? "Matikan bunyi pesanan baru" : "Nyalakan bunyi pesanan baru"}
              title={sound ? "Bunyi pesanan baru: nyala" : "Bunyi pesanan baru: mati"}
              onClick={() => {
                const next = !sound;
                try {
                  localStorage.setItem("mezan-sound", next ? "on" : "off");
                } catch {
                  /* abaikan */
                }
                setSound(next);
              }}
            >
              {sound ? <Bell /> : <BellOff />}
            </button>
          </>
        }
      />
      {tab === "active" ? <Board /> : <History />}
    </>
  );
}

function Board() {
  const { orders, error, reload } = useOrderFeed();
  const phone = useMediaQuery("(max-width: 699px)");
  const [col, setCol] = useState<Col>("new");
  if (error && !orders) return <ErrorState message={error} onRetry={reload} />;
  if (!orders) return <Loading rows={4} height={120} />;
  const grouped: Record<Col, Order[]> = { new: [], preparing: [], ready: [] };
  // Yang paling lama menunggu di atas.
  [...orders].sort((a, b) => a.created_at - b.created_at).forEach((o) => grouped[columnOf(o)].push(o));
  const shown = phone ? COLS.filter((c) => c.key === col) : COLS;

  return (
    <>
      {phone && (
        <div style={{ marginBottom: 14 }}>
          <Segmented
            label="Kolom pesanan"
            value={col}
            onChange={setCol}
            options={COLS.map((c) => ({ value: c.key, label: `${c.title.split(" ")[0]} (${grouped[c.key].length})` }))}
          />
        </div>
      )}
      <div className="board">
        {shown.map((c) => (
          <section className="board-col" key={c.key} aria-labelledby={`col-${c.key}`}>
            {!phone && (
              <header>
                <h2 id={`col-${c.key}`}>{c.title}</h2>
                <span className={`badge ${c.key === "new" && grouped.new.length ? "badge-new" : ""}`}>{grouped[c.key].length}</span>
              </header>
            )}
            {phone && <h2 id={`col-${c.key}`} className="sr-only">{c.title}</h2>}
            {grouped[c.key].length === 0 ? (
              <div className="panel">
                <p className="muted small">{c.empty}</p>
              </div>
            ) : (
              grouped[c.key].map((o) => <Ticket key={o.id} order={o} onChanged={reload} />)
            )}
          </section>
        ))}
      </div>
    </>
  );
}

function Ticket({ order: o, onChanged }: { order: Order; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { tenant } = useSession();
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const waitMin = Math.floor((Date.now() - o.created_at) / 60000);

  const move = async (status: Order["status"], extra?: object) => {
    setBusy(true);
    try {
      await api.patch(`/api/store/orders/${o.id}/status`, { status, ...extra });
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const pay = async (p: { method: string; amountReceived: number | null }) => {
    setBusy(true);
    try {
      await api.patch(`/api/store/orders/${o.id}/pay`, p);
      setPaying(false);
      toast(`Pesanan #${o.number} lunas.`);
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="receipt-edge" aria-label={`Pesanan nomor ${o.number}`}>
      <div className="ticket">
        <div className="ticket-top">
          <div>
            <div className="ticket-no num">#{o.number}</div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {o.table_label ?? (o.order_type === "takeaway" ? "Bawa pulang" : "Tanpa meja")}
              {o.customer_name && ` · ${o.customer_name}`}
            </div>
          </div>
          <div style={{ textAlign: "right" }} className="stack-sm">
            <span className={`badge ${o.source === "qr" ? "badge-info" : ""}`}>
              {o.source === "qr" ? <QrCode aria-hidden="true" /> : <ShoppingBasket aria-hidden="true" />}
              {o.source === "qr" ? "QR meja" : "Kasir"}
            </span>
            <span className={`tiny ${waitMin >= 15 && o.status !== "done" ? "strong" : "muted"}`} style={waitMin >= 15 && o.status !== "done" ? { color: "var(--danger)" } : undefined}>
              {time(o.created_at)} · {ago(o.created_at)}
            </span>
          </div>
        </div>
        <ul className="ticket-items">
          {o.items.map((i) => (
            <li key={i.id}>
              <span className="q num">{i.qty}×</span>
              <span>
                {i.name}
                {i.note && <span className="note">Catatan: {i.note}</span>}
              </span>
            </li>
          ))}
        </ul>
        {o.note && <p className="small" style={{ color: "var(--warn-text)", fontWeight: 600 }}>Catatan pesanan: {o.note}</p>}
        <hr className="divider-dashed" style={{ margin: 0 }} />
        <div className="row between">
          <span className="strong money">{rupiah(o.total)}</span>
          {o.payment_status === "paid" ? (
            <span className="badge badge-ok">Lunas · {PAY_LABEL[o.payment_method ?? "lainnya"]}</span>
          ) : (
            <span className="badge badge-warn">Belum bayar</span>
          )}
        </div>
        {o.status === "done" && <p className="tiny muted">Sudah diantar, tinggal pembayaran.</p>}
        <div className="ticket-actions">
          {o.status === "new" && (
            <>
              <button className="btn btn-primary" disabled={busy} onClick={() => move("preparing")}>
                Terima & buat
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => setCancelOpen(true)}>
                Tolak
              </button>
            </>
          )}
          {o.status === "preparing" && (
            <button className="btn btn-primary" disabled={busy} onClick={() => move("ready")}>
              Siap diantar
            </button>
          )}
          {o.status === "ready" && (
            <button className="btn btn-primary" disabled={busy} onClick={() => move("done")}>
              Sudah diantar
            </button>
          )}
          {o.payment_status === "unpaid" && o.status !== "new" && (
            <button className={`btn ${o.status === "done" ? "btn-primary" : ""}`} disabled={busy} onClick={() => setPaying(true)}>
              Terima bayar
            </button>
          )}
          {(o.status === "preparing" || o.status === "ready") && (
            <button
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={async () => {
                if (await confirm({ title: `Batalkan pesanan #${o.number}?`, body: "Stok barang di pesanan ini akan dikembalikan.", confirm: "Batalkan pesanan", danger: true })) {
                  move("cancelled", { reason: "Dibatalkan kasir" });
                }
              }}
            >
              Batalkan
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm"
            aria-label={`Cetak struk pesanan ${o.number}`}
            onClick={() => tenant && !printReceipt(o, tenant) && toast("Izinkan pop-up di browser untuk mencetak struk.", "error")}
          >
            <Printer />
          </button>
        </div>
      </div>
      <PaymentModal open={paying} total={o.total} busy={busy} onClose={() => setPaying(false)} onPay={pay} title={`Bayar pesanan #${o.number}`} />
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={`Tolak pesanan #${o.number}?`}
        footer={
          <>
            <button className="btn" onClick={() => setCancelOpen(false)}>
              Kembali
            </button>
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={async () => {
                await move("cancelled", { reason: reason || "Ditolak" });
                setCancelOpen(false);
              }}
            >
              Tolak pesanan
            </button>
          </>
        }
      >
        <div className="stack">
          <p>Pelanggan akan melihat alasan ini di HP-nya.</p>
          <div className="row wrap">
            {["Menu habis", "Dapur sudah tutup", "Pesanan dobel", "Pelanggan tidak ada di meja"].map((r) => (
              <button key={r} type="button" className="chip" aria-pressed={reason === r} onClick={() => setReason(r)}>
                {r}
              </button>
            ))}
          </div>
          <input className="input" placeholder="Atau tulis alasan lain" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} aria-label="Alasan menolak" />
        </div>
      </Modal>
    </article>
  );
}

function History() {
  const { tenant } = useSession();
  const today = new Date().toLocaleDateString("en-CA");
  const [day, setDay] = useState(today);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, error, loading, reload } = useApi<{ orders: Order[] }>(`/api/store/orders?scope=history&day=${day}&q=${encodeURIComponent(query)}`);
  const [open, setOpen] = useState<Order | null>(null);
  const toast = useToast();
  const orders = data?.orders ?? [];
  const valid = orders.filter((o) => o.status !== "cancelled");
  const paidTotal = valid.filter((o) => o.payment_status === "paid").reduce((s, o) => s + o.total, 0);

  return (
    <div className="stack">
      <form
        className="row wrap"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
      >
        <input type="date" className="input" style={{ width: "auto" }} value={day} max={today} onChange={(e) => setDay(e.target.value || today)} aria-label="Tanggal" />
        <div className="cust-search" style={{ flex: "1 1 220px" }}>
          <Search aria-hidden="true" />
          <input className="input" placeholder="Cari nama, meja, atau nomor" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari pesanan" />
        </div>
        <button className="btn" type="submit">
          Cari
        </button>
      </form>
      {error ? (
        <ErrorState message={error.message} onRetry={() => reload()} />
      ) : loading ? (
        <Loading rows={5} height={48} />
      ) : orders.length === 0 ? (
        <div className="panel">
          <Empty title="Belum ada pesanan">Tidak ada pesanan {query ? `yang cocok dengan "${query}" ` : ""}pada tanggal ini.</Empty>
        </div>
      ) : (
        <div className="panel flush">
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }} className="row between wrap">
            <span className="strong">{orders.length} pesanan</span>
            <span className="muted small">
              Sudah dibayar: <span className="strong money" style={{ color: "var(--ink)" }}>{rupiah(paidTotal)}</span>
            </span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Jam</th>
                  <th>Meja / nama</th>
                  <th>Status</th>
                  <th className="r">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <button className="btn btn-ghost btn-sm num" onClick={() => setOpen(o)} aria-label={`Lihat detail pesanan ${o.number}`}>
                        #{o.number}
                      </button>
                    </td>
                    <td className="num">{time(o.created_at)}</td>
                    <td>
                      {o.table_label ?? "Bawa pulang"}
                      {o.customer_name && <span className="muted"> · {o.customer_name}</span>}
                    </td>
                    <td>
                      <span className={`badge ${o.status === "cancelled" ? "badge-danger" : o.status === "done" ? "" : "badge-info"}`}>{STATUS_LABEL[o.status]}</span>{" "}
                      {o.status !== "cancelled" && (o.payment_status === "paid" ? <span className="badge badge-ok">{PAY_LABEL[o.payment_method ?? "lainnya"]}</span> : <span className="badge badge-warn">Belum bayar</span>)}
                    </td>
                    <td className="r money">{rupiah(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? `Pesanan #${open.number}` : ""}
        footer={
          open && (
            <button className="btn" onClick={() => tenant && !printReceipt(open, tenant) && toast("Izinkan pop-up di browser untuk mencetak struk.", "error")}>
              <Printer /> Cetak struk
            </button>
          )
        }
      >
        {open && (
          <div className="stack">
            <p className="muted small">
              {time(open.created_at)} · {open.source === "qr" ? "Dipesan lewat QR meja" : `Dicatat kasir${open.created_by_name ? ` (${open.created_by_name})` : ""}`}
              {open.cancel_reason && ` · Batal: ${open.cancel_reason}`}
            </p>
            <ul className="ticket-items">
              {open.items.map((i) => (
                <li key={i.id}>
                  <span className="q num">{i.qty}×</span>
                  <span className="row between">
                    <span>
                      {i.name}
                      {i.note && <span className="note">{i.note}</span>}
                    </span>
                    <span className="money">{rupiah(i.qty * i.price)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <hr className="divider-dashed" />
            {open.service > 0 && <div className="sum-row"><span>Service</span><span className="money">{rupiah(open.service)}</span></div>}
            {open.tax > 0 && <div className="sum-row"><span>Pajak</span><span className="money">{rupiah(open.tax)}</span></div>}
            <div className="sum-row total"><span>Total</span><span className="money">{rupiah(open.total)}</span></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
