import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, ChefHat, ClipboardCheck, HandPlatter, XCircle } from "lucide-react";
import { ErrorState, Loading } from "../../components/ui";
import { rupiah, time } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { ThemedRoot } from "../../components/ThemedRoot";
import { DEFAULT_THEME, type MenuTheme } from "../../../../shared/menuTheme";
import { LangSwitch, useLang } from "../../lib/lang";
import { QUICK_NOTES } from "../../../../shared/i18n";

// Alasan tolak bawaan dari layar kasir, diterjemahkan untuk pembeli asing.
const REASON_EN: Record<string, string> = {
  "Menu habis": "Sold out",
  "Dapur sudah tutup": "Kitchen is closed",
  "Pesanan dobel": "Duplicate order",
  "Pelanggan tidak ada di meja": "Nobody at the table",
  Ditolak: "Declined",
  "Dibatalkan kasir": "Cancelled by the cashier",
};

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
  order_type?: "dine_in" | "takeaway";
  items: { id: string; name: string; name_en: string; qty: number; price: number; note: string }[];
}

const STEPS = [
  { key: "new", icon: ClipboardCheck },
  { key: "preparing", icon: ChefHat },
  { key: "ready", icon: HandPlatter },
  { key: "done", icon: Check },
] as const;

export function OrderStatusPage() {
  const { code = "", token = "" } = useParams();
  const { lang, setLang, t } = useLang();
  const { data, error, loading, reload } = useApi<{ order: PublicOrder; theme?: MenuTheme }>(`/api/public/orders/${token}?lang=${lang}`, { poll: 5000 });
  const o = data?.order;
  useEffect(() => {
    if (o) document.title = `${t.orderNo(o.number)} · ${o.store_name}`;
  }, [o, t]);
  const en = lang === "en";
  const noteText = (n: string) => (en ? n.split(",").map((x) => QUICK_NOTES.find((q) => q.id === x.trim())?.en ?? x.trim()).join(", ") : n);

  if (error && !o) return <div className="cust"><ErrorState title={t.loadFail} retryLabel={t.retry} message={error.message} onRetry={() => reload()} /></div>;
  if (loading || !o) return <div className="cust" style={{ padding: 16 }}><Loading rows={4} height={70} /></div>;

  const idx = STEPS.findIndex((s) => s.key === o.status);
  const cancelled = o.status === "cancelled";
  const steps = o.order_type === "takeaway" ? t.stepsTakeaway : t.steps;

  return (
    <ThemedRoot theme={data?.theme ?? DEFAULT_THEME}>
    <div className="cust" style={{ padding: "20px 16px 40px" }}>
      <div className="stack" style={{ gap: 20 }}>
        <div>
          <div className="cust-top">
            <p className="muted small">{o.store_name} · {o.table_label ?? t.takeaway}</p>
            <LangSwitch lang={lang} setLang={setLang} />
          </div>
          <h1 style={{ fontFamily: "var(--font-menu)", fontSize: "2rem", marginTop: 4 }}>{t.orderNo(o.number)}</h1>
          <p className="muted small">{t.forName(o.customer_name || "-", time(o.created_at))}</p>
        </div>

        {cancelled ? (
          <div className="banner danger" role="status">
            <XCircle aria-hidden="true" />
            <div>
              {t.cancelled(o.cancel_reason ? (en ? REASON_EN[o.cancel_reason] ?? o.cancel_reason : o.cancel_reason) : "")}
            </div>
          </div>
        ) : (
          <ol className="status-steps" aria-label={t.orderStatus}>
            {STEPS.map((s, i) => {
              const state = i < idx ? "done" : i === idx ? (s.key === "done" ? "done" : "current") : "todo";
              const Icon = s.icon;
              return (
                <li key={s.key} className={state} aria-current={i === idx ? "step" : undefined}>
                  <span className="dot">{state !== "todo" && <Icon aria-hidden="true" />}</span>
                  <div>
                    <div className="label">{steps[i][0]}</div>
                    {i === idx && <div className="small muted">{steps[i][1]}</div>}
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
                      {en && i.name_en && <span className="tiny muted" style={{ display: "block" }}>{i.name_en}</span>}
                      {i.note && <span className="note">{noteText(i.note)}</span>}
                    </span>
                    <span className="money">{rupiah(i.qty * i.price)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <hr className="divider-dashed" style={{ margin: "4px 0" }} />
            {o.service > 0 && <div className="sum-row small muted"><span>{t.service}</span><span className="money">{rupiah(o.service)}</span></div>}
            {o.tax > 0 && <div className="sum-row small muted"><span>{t.tax}</span><span className="money">{rupiah(o.tax)}</span></div>}
            <div className="sum-row total"><span>{t.total}</span><span className="money">{rupiah(o.total)}</span></div>
            <div>
              {o.payment_status === "paid" ? <span className="badge badge-ok">{t.paid}</span> : <span className="badge badge-warn">{t.payHere}</span>}
            </div>
          </div>
        </div>

        {o.table_code && code && (
          <Link className="btn btn-lg" to={`/m/${code}`}>
            {t.orderAgain}
          </Link>
        )}
      </div>
    </div>
    </ThemedRoot>
  );
}
