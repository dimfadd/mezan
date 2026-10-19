import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, ChefHat, ClipboardCheck, HandPlatter, XCircle } from "lucide-react";
import { ErrorState, Loading } from "../../components/ui";
import { rupiah, time } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { ThemedRoot } from "../../components/ThemedRoot";
import { DEFAULT_THEME, type MenuTheme } from "../../../../shared/menuTheme";

interface PublicOrder {
  number: number;
  table_label: string | null;
  customer_name: string;
  status: "new" | "preparing" | "ready" | "done" | "cancelled";
  payment_status: "paid" | "unpaid";
  subtotal: number;
  tax: number;
  service: number;
  total: number;
  note: string;
  created_at: number;
  cancel_reason: string | null;
  store_name: string;
  table_code: string | null;
  items: { id: string; name: string; qty: number; price: number; note: string }[];
}

const STEPS = [
  { key: "new", label: "Pesanan terkirim", desc: "Menunggu kasir menerima.", icon: ClipboardCheck },
  { key: "preparing", label: "Sedang dibuat", desc: "Dapur sedang menyiapkan pesananmu.", icon: ChefHat },
  { key: "ready", label: "Siap diantar", desc: "Sebentar lagi sampai di meja.", icon: HandPlatter },
  { key: "done", label: "Sudah diantar", desc: "Selamat makan.", icon: Check },
] as const;

export function OrderStatusPage() {
  const { code = "", token = "" } = useParams();
  const { data, error, loading, reload } = useApi<{ order: PublicOrder; theme?: MenuTheme }>(`/api/public/orders/${token}`, { poll: 5000 });
  const o = data?.order;
  useEffect(() => {
    if (o) document.title = `Pesanan #${o.number} · ${o.store_name}`;
  }, [o]);

  if (error && !o) return <div className="cust"><ErrorState message={error.message} onRetry={() => reload()} /></div>;
  if (loading || !o) return <div className="cust" style={{ padding: 16 }}><Loading rows={4} height={70} /></div>;

  const idx = STEPS.findIndex((s) => s.key === o.status);
  const cancelled = o.status === "cancelled";

  return (
    <ThemedRoot theme={data?.theme ?? DEFAULT_THEME}>
    <div className="cust" style={{ padding: "20px 16px 40px" }}>
      <div className="stack" style={{ gap: 20 }}>
        <div>
          <p className="muted small">{o.store_name} · {o.table_label ?? "Bawa pulang"}</p>
          <h1 style={{ fontFamily: "var(--font-menu)", fontSize: "2rem", marginTop: 4 }}>Pesanan #{o.number}</h1>
          <p className="muted small">Atas nama {o.customer_name || "-"} · {time(o.created_at)}. Halaman ini diperbarui otomatis.</p>
        </div>

        {cancelled ? (
          <div className="banner danger" role="status">
            <XCircle aria-hidden="true" />
            <div>
              Pesanan ini dibatalkan{o.cancel_reason ? `: ${o.cancel_reason}` : ""}. Silakan tanya kasir atau pesan ulang.
            </div>
          </div>
        ) : (
          <ol className="status-steps" aria-label="Status pesanan">
            {STEPS.map((s, i) => {
              const state = i < idx ? "done" : i === idx ? (s.key === "done" ? "done" : "current") : "todo";
              const Icon = s.icon;
              return (
                <li key={s.key} className={state} aria-current={i === idx ? "step" : undefined}>
                  <span className="dot">{state !== "todo" && <Icon aria-hidden="true" />}</span>
                  <div>
                    <div className="label">{s.label}</div>
                    {i === idx && <div className="small muted">{s.desc}</div>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="receipt-edge" style={{ ["--edge-color" as string]: "var(--surface)" }}>
          <div className="ticket" style={{ borderRadius: "var(--radius-lg) var(--radius-lg) 0 0" }}>
            <ul className="ticket-items">
              {o.items.map((i) => (
                <li key={i.id}>
                  <span className="q num">{i.qty}×</span>
                  <span className="row between" style={{ alignItems: "flex-start" }}>
                    <span>
                      {i.name}
                      {i.note && <span className="note">{i.note}</span>}
                    </span>
                    <span className="money">{rupiah(i.qty * i.price)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <hr className="divider-dashed" style={{ margin: "4px 0" }} />
            {o.service > 0 && <div className="sum-row small muted"><span>Service</span><span className="money">{rupiah(o.service)}</span></div>}
            {o.tax > 0 && <div className="sum-row small muted"><span>Pajak</span><span className="money">{rupiah(o.tax)}</span></div>}
            <div className="sum-row total"><span>Total</span><span className="money">{rupiah(o.total)}</span></div>
            <div>
              {o.payment_status === "paid" ? <span className="badge badge-ok">Sudah dibayar</span> : <span className="badge badge-warn">Bayar di kasir</span>}
            </div>
          </div>
        </div>

        {o.table_code && code && (
          <Link className="btn btn-lg" to={`/m/${code}`}>
            Pesan lagi
          </Link>
        )}
      </div>
    </div>
    </ThemedRoot>
  );
}
