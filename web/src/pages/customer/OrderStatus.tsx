import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, ChefHat, ClipboardCheck, HandPlatter, XCircle, Star, ThumbsUp, ThumbsDown, Stamp, ExternalLink, Timer } from "lucide-react";
import { ErrorState, Field, Loading, useToast } from "../../components/ui";
import { api } from "../../lib/api";
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
  payment_method?: string | null;
  paid_at?: number | null;
  store_address?: string;
  source?: string;
  items: { id: string; menu_item_id: string | null; name: string; name_en: string; qty: number; price: number; note: string; list_price?: number | null }[];
}
interface Eta {
  position: number;
  ahead: number;
  ready_at: number;
  low_min: number;
  high_min: number;
  late: boolean;
  accepted: boolean;
  now: number;
}
interface Feedback {
  sent: boolean;
  rating: number | null;
  review_url: string | null;
}
interface Loyalty {
  target: number;
  reward: string;
  min_spend: number;
  card: { stamps: number; ready: boolean } | null;
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
  const { data, error, loading, reload } = useApi<{ order: PublicOrder; theme?: MenuTheme; feedback?: Feedback; loyalty?: Loyalty | null; eta?: Eta | null }>(`/api/public/orders/${token}?lang=${lang}`, { poll: 5000 });
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

        {!cancelled && data?.eta && <EtaBox eta={data.eta} createdAt={o.created_at} />}

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
                    <span className="money">
                      {i.list_price ? <s className="was">{rupiah(i.qty * i.list_price)}</s> : null} {rupiah(i.qty * i.price)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <hr className="divider-dashed" style={{ margin: "4px 0" }} />
            {o.service > 0 && <div className="sum-row small muted"><span>{t.service}</span><span className="money">{rupiah(o.service)}</span></div>}
            {o.tax > 0 && <div className="sum-row small muted"><span>{t.tax}</span><span className="money">{rupiah(o.tax)}</span></div>}
            <div className="sum-row total"><span>{t.total}</span><span className="money">{rupiah(o.total)}</span></div>
            <div>
              {o.payment_status === "paid" ? (
                <span className="badge badge-ok">{o.payment_method ? t.paidWith(t.payMethods[o.payment_method] ?? o.payment_method) : t.paid}</span>
              ) : (
                <span className="badge badge-warn">{t.payHere}</span>
              )}
            </div>
            {o.store_address && <p className="tiny muted">{o.store_name} · {o.store_address}</p>}
          </div>
        </div>

        {!cancelled && data?.loyalty && <StampBox token={token} paid={o.payment_status === "paid"} loyalty={data.loyalty} total={o.total} onDone={() => reload(true)} />}
        {!cancelled && data?.feedback && (o.status === "done" || o.status === "ready" || o.payment_status === "paid") && (
          <RateBox token={token} items={o.items} feedback={data.feedback} onDone={() => reload(true)} />
        )}

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

/** Antrean ke-berapa dan perkiraan siap. Angkanya dari server, diperbarui setiap polling. */
function EtaBox({ eta, createdAt }: { eta: Eta; createdAt: number }) {
  const { lang, t } = useLang();
  const at = lang === "en" ? time(eta.ready_at).replace(".", ":") : time(eta.ready_at);
  const span = Math.max(1, eta.ready_at - createdAt);
  const pct = Math.min(96, Math.max(4, ((eta.now - createdAt) / span) * 100));
  const soon = eta.high_min <= 3;
  return (
    <section className={`eta-box${eta.late ? " late" : ""}`} aria-labelledby="eta-h" aria-live="polite">
      <div className="eta-top">
        <span className="eta-pill num">{t.etaQueue(eta.position)}</span>
        <span className="eta-ahead small">{eta.accepted && eta.ahead === 0 ? t.etaCooking : t.etaAhead(eta.ahead)}</span>
      </div>
      <h2 id="eta-h" className="eta-label small">
        <Timer aria-hidden="true" /> {t.etaTitle}
      </h2>
      <p className="eta-big num">{eta.late || soon ? t.etaSoon : t.etaRange(eta.low_min, eta.high_min)}</p>
      {!eta.late && !soon && <p className="small muted">{t.etaAt(at)}</p>}
      <div className="eta-bar" role="presentation"><span style={{ width: `${pct}%` }} /></div>
      <p className="tiny muted">{eta.late ? t.etaLate : !eta.accepted ? t.etaWaitAccept : t.etaNote}</p>
    </section>
  );
}

function RateBox({ token, items, feedback, onDone }: { token: string; items: PublicOrder["items"]; feedback: Feedback; onDone: () => void }) {
  const { lang, t } = useLang();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(feedback.sent);
  const dishes = [...new Map(items.filter((i) => i.menu_item_id).map((i) => [i.menu_item_id!, i])).values()];
  const google = feedback.review_url;

  if (sent) {
    return (
      <section className="panel stack rate-box" aria-label={t.rateTitle}>
        <p className="strong">{t.rateThanks}</p>
        {google && (
          <>
            <p className="small muted">{t.rateGoogleSub}</p>
            <a className="btn" href={google} target="_blank" rel="noopener noreferrer"><ExternalLink /> {t.rateGoogle}</a>
          </>
        )}
      </section>
    );
  }
  const send = async () => {
    setBusy(true);
    try {
      await api.post(`/api/public/orders/${token}/feedback`, { rating, comment, lang, items: Object.entries(liked).map(([id, l]) => ({ id, liked: l })) });
      setSent(true);
      onDone();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel stack rate-box" aria-labelledby="rate-h">
      <div>
        <h2 id="rate-h">{t.rateTitle}</h2>
        <p className="small muted">{t.rateSub}</p>
      </div>
      <div className="stars" role="radiogroup" aria-label={t.rateTitle}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={t.rateStars(n)} className={n <= rating ? "on" : ""} onClick={() => setRating(n)}>
            <Star aria-hidden="true" />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          {dishes.length > 0 && (
            <div className="stack-sm">
              <span className="small strong">{t.ratePerItem}</span>
              {dishes.map((d) => {
                const v = liked[d.menu_item_id!];
                const set = (x: boolean) => setLiked((s) => (s[d.menu_item_id!] === x ? (({ [d.menu_item_id!]: _, ...rest }) => rest)(s) : { ...s, [d.menu_item_id!]: x }));
                return (
                  <div key={d.menu_item_id} className="rate-item">
                    <span>{lang === "en" && d.name_en ? d.name_en : d.name}</span>
                    <span className="row" style={{ gap: 4 }}>
                      <button type="button" className={`thumb${v === true ? " on" : ""}`} aria-pressed={v === true} aria-label={`${t.liked}: ${d.name}`} onClick={() => set(true)}><ThumbsUp aria-hidden="true" /></button>
                      <button type="button" className={`thumb down${v === false ? " on" : ""}`} aria-pressed={v === false} aria-label={`${t.disliked}: ${d.name}`} onClick={() => set(false)}><ThumbsDown aria-hidden="true" /></button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <Field label={t.rateComment} htmlFor="rate-c">
            <textarea id="rate-c" className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} placeholder={t.rateCommentPh} />
          </Field>
          <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={send}>{busy ? t.sending : t.rateSend}</button>
        </>
      )}
    </section>
  );
}

function StampBox({ token, paid, loyalty, total, onDone }: { token: string; paid: boolean; loyalty: Loyalty; total: number; onDone: () => void }) {
  const { lang, t } = useLang();
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const card = loyalty.card;
  const eligible = total >= loyalty.min_spend;
  if (!card && !eligible) return null;
  const claim = async () => {
    setBusy(true);
    try {
      await api.post(`/api/public/orders/${token}/stamp`, { phone, lang });
      onDone();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel stack" aria-labelledby="stamp-h">
      <div>
        <h2 id="stamp-h"><Stamp aria-hidden="true" className="h-ico" /> {t.stampTitle}</h2>
        <p className="small muted">
          {t.stampSub(loyalty.target, loyalty.reward)}
          {loyalty.min_spend > 0 ? ` ${t.stampMin(rupiah(loyalty.min_spend))}` : ""}
        </p>
      </div>
      {card ? (
        <>
          <div className="stamp-card" aria-label={t.stampHave(card.stamps, loyalty.target)}>
            {Array.from({ length: Math.min(loyalty.target, 20) }, (_, i) => (
              <i key={i} className={i < card.stamps ? "on" : ""}>{i < card.stamps && <Check aria-hidden="true" />}</i>
            ))}
          </div>
          <p className="strong">{t.stampHave(card.stamps, loyalty.target)}</p>
          <p className="small">{card.ready ? t.stampReady(loyalty.reward) : t.stampLeft(loyalty.target - card.stamps, loyalty.reward)}</p>
        </>
      ) : paid ? (
        <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
          <Field label={t.stampPhone} htmlFor="st-phone">
            <input id="st-phone" className="input" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="0812 3456 7890" />
          </Field>
          <button type="button" className="btn btn-primary" disabled={busy || phone.replace(/\D/g, "").length < 9} onClick={claim}>{t.stampClaim}</button>
        </div>
      ) : (
        <p className="small muted">{t.stampAfterPay}</p>
      )}
    </section>
  );
}
