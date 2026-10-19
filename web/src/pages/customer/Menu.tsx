import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronRight, Clock3, Images, Minus, Play, Plus, Search, Trash2, UtensilsCrossed, X } from "lucide-react";
import { Empty, ErrorState, Field, Loading, Modal, Thumb, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { rupiah } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { LangSwitch, useLang } from "../../lib/lang";
import { ThemedRoot } from "../../components/ThemedRoot";
import { Gallery, mediaSummary, type MediaRef } from "../../components/Gallery";
import { DishFacts } from "../../components/DishInfo";
import { DEFAULT_THEME, type MenuTheme } from "../../../../shared/menuTheme";
import { loc, QUICK_NOTES, type Lang } from "../../../../shared/i18n";

interface Dish {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  video_url: string | null;
  tags: string;
  sold_out: boolean;
  few_left: number | null;
  media: MediaRef[];
  portion: string;
  components: string;
  spice_level: number | null;
  prep_minutes: number | null;
  allergens: string;
  name_en: string;
  description_en: string;
  portion_en: string;
  components_en: string;
  allergens_en: string;
}
interface MenuData {
  store: { name: string; address: string; welcome_note: string; welcome_note_en: string; tax_rate: number; service_rate: number; accepting_orders: boolean; theme?: MenuTheme };
  table: { label: string; area: string };
  categories: { id: string; name: string; name_en: string }[];
  items: Dish[];
}
interface CartLine {
  id: string;
  qty: number;
  note: string;
}

const cartKey = (code: string) => `mezan-cart-${code}`;
const ordersKey = (code: string) => `mezan-orders-${code}`;

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* mode privat: keranjang tetap jalan di memori */
  }
}

/** Keterangan Inggris di bawah nama asli. Nama asli tetap utama supaya pelayan paham saat disebut. */
const subtitle = (lang: Lang, d: Dish) => (lang === "en" && d.name_en && d.name_en !== d.name ? d.name_en : null);

export function CustomerMenuPage() {
  const { code = "" } = useParams();
  const { lang, setLang, t } = useLang();
  const { data, error, loading, reload } = useApi<MenuData>(`/api/public/table/${code}?lang=${lang}`);
  const [cart, setCart] = useState<CartLine[]>(() => loadJSON(cartKey(code), []));
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Dish | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const myOrders = loadJSON<{ token: string; number: number; at: number }[]>(ordersKey(code), []).filter((o) => Date.now() - o.at < 12 * 3600_000);

  useEffect(() => saveJSON(cartKey(code), cart), [cart, code]);
  useEffect(() => {
    if (data) document.title = `${data.store.name} · ${t.menu}`;
  }, [data, t]);

  const byId = useMemo(() => new Map((data?.items ?? []).map((i) => [i.id, i])), [data]);
  // Buang item yang sudah tidak ada/habis dari keranjang lama.
  const validCart = cart.filter((l) => byId.has(l.id) && !byId.get(l.id)!.sold_out);
  const count = validCart.reduce((s, l) => s + l.qty, 0);
  const subtotal = validCart.reduce((s, l) => s + byId.get(l.id)!.price * l.qty, 0);

  const sections = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    // Cari di kedua bahasa, supaya "fried rice" maupun "nasi goreng" sama-sama ketemu.
    const match = (i: Dish) => !s || [i.name, i.description, i.name_en, i.description_en].some((x) => x?.toLowerCase().includes(s));
    const list = data.categories.map((c) => ({ id: c.id, name: loc(lang, c.name, c.name_en), items: data.items.filter((i) => i.category_id === c.id && match(i)) }));
    const none = data.items.filter((i) => (!i.category_id || !data.categories.some((c) => c.id === i.category_id)) && match(i));
    if (none.length) list.push({ id: "lain", name: t.other, items: none });
    return list.filter((x) => x.items.length > 0);
  }, [data, q, lang, t]);

  const addLine = (id: string, qty: number, note: string) => {
    setCart((c) => {
      const ex = c.find((l) => l.id === id && l.note === note);
      if (ex) return c.map((l) => (l === ex ? { ...l, qty: Math.min(50, l.qty + qty) } : l));
      return [...c, { id, qty, note }];
    });
  };

  if (error && !data) {
    return (
      <div className="cust">
        <div className="cust-top" style={{ padding: "16px 16px 0", justifyContent: "flex-end" }}>
          <LangSwitch lang={lang} setLang={setLang} />
        </div>
        <ErrorState title={t.loadFail} retryLabel={t.retry} message={error.message} onRetry={error.status === 404 ? undefined : () => reload()} />
      </div>
    );
  }
  if (loading || !data) {
    return (
      <div className="cust" style={{ padding: 16 }}>
        <Loading rows={6} height={110} />
      </div>
    );
  }

  const theme = data.store.theme ?? DEFAULT_THEME;
  const welcome = loc(lang, data.store.welcome_note, data.store.welcome_note_en);
  return (
    <ThemedRoot theme={theme}>
    <div className="cust">
      <header className="cust-head">
        <div className="cust-top">
          {theme.logo ? <img className="cust-logo" src={theme.logo} alt={`Logo ${data.store.name}`} /> : (
            <span className="table-tag">
              <UtensilsCrossed aria-hidden="true" /> {data.table.label}
              {data.table.area && ` · ${data.table.area}`}
            </span>
          )}
          <LangSwitch lang={lang} setLang={setLang} />
        </div>
        {theme.logo && (
          <span className="table-tag">
            <UtensilsCrossed aria-hidden="true" /> {data.table.label}
            {data.table.area && ` · ${data.table.area}`}
          </span>
        )}
        <h1 className="store">{data.store.name}</h1>
        {welcome && <p className="muted">{welcome}</p>}
        {!data.store.accepting_orders && (
          <div className="banner info" style={{ margin: "8px 0 0" }}>
            <Clock3 aria-hidden="true" />
            <div>{t.notOpen}</div>
          </div>
        )}
        {myOrders.length > 0 && (
          <Link className="btn btn-sm" style={{ justifySelf: "start", marginTop: 6 }} to={`/m/${code}/pesanan/${myOrders[myOrders.length - 1].token}`}>
            {t.seeStatus} #{myOrders[myOrders.length - 1].number} <ChevronRight />
          </Link>
        )}
      </header>

      <nav className="cust-nav" aria-label={t.menu}>
        <div className="cust-search">
          <Search aria-hidden="true" />
          <input className="input" type="search" placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t.search} />
        </div>
        {!q && sections.length > 1 && (
          <div className="chips">
            {sections.map((s) => (
              <button
                key={s.id}
                className="chip"
                aria-pressed={activeCat === s.id}
                onClick={() => {
                  setActiveCat(s.id);
                  document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </nav>

      {sections.length === 0 ? (
        <Empty title={q ? t.notFound : t.emptyMenu}>{q ? t.noMatch(q) : t.emptyMenuBody}</Empty>
      ) : (
        sections.map((s) => (
          <section key={s.id} id={`sec-${s.id}`} className="cust-section" aria-labelledby={`h-${s.id}`}>
            <h2 id={`h-${s.id}`}>{s.name}</h2>
            <div className="dish-list">
              {s.items.map((d) => {
                const inCart = validCart.filter((l) => l.id === d.id).reduce((n, l) => n + l.qty, 0);
                const sub = subtitle(lang, d);
                const desc = loc(lang, d.description, d.description_en);
                return (
                  <button key={d.id} className={`dish${d.sold_out ? " sold" : ""}`} onClick={() => setOpen(d)} aria-label={`${d.name}${sub ? `, ${sub}` : ""}, ${rupiah(d.price)}${d.sold_out ? `, ${t.soldOut}` : ""}. ${t.seeDetail}`}>
                    {inCart > 0 && <span className="count added">{inCart}</span>}
                    <div style={{ minWidth: 0 }}>
                      <div className="name">{d.name}</div>
                      {sub && <div className="name-en">{sub}</div>}
                      {desc && <div className="desc">{desc}</div>}
                      <div className="price">{rupiah(d.price)}</div>
                      <div className="tags">
                        {d.sold_out && <span className="badge badge-danger">{t.soldOut}</span>}
                        {d.few_left != null && <span className="badge badge-warn">{t.fewLeft(d.few_left)}</span>}
                        {d.tags.split(",").filter(Boolean).map((tg) => (
                          <span key={tg} className={`badge ${tg === "pedas" ? "badge-danger" : tg === "favorit" ? "badge-new" : ""}`}>{t.tags[tg] ?? tg}</span>
                        ))}
                      </div>
                    </div>
                    <div className="media">
                      {d.image_url ? (
                        <img src={d.image_url} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : d.video_url ? (
                        <video src={`${d.video_url}#t=0.5`} muted playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} aria-hidden="true" />
                      ) : (
                        <Thumb name={d.name} />
                      )}
                      {(d.media.length > 1 || d.video_url) && (
                        <span className="play">
                          {d.video_url ? <Play aria-hidden="true" /> : <Images aria-hidden="true" />} {mediaSummary(d.media, lang) || t.videos(1)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}

      {count > 0 && (
        <button className="cartbar" onClick={() => setCartOpen(true)}>
          <span>
            {t.items(count)} · <span className="money">{rupiah(subtotal)}</span>
          </span>
          <span className="go">
            {data.store.accepting_orders ? t.viewOrder : t.viewChoices} <ChevronRight aria-hidden="true" />
          </span>
        </button>
      )}

      {open && <DishModal dish={open} lang={lang} canOrder={data.store.accepting_orders} onClose={() => setOpen(null)} onAdd={(qty, note) => { addLine(open.id, qty, note); setOpen(null); }} />}
      <CartModal
        open={cartOpen}
        code={code}
        lang={lang}
        data={data}
        lines={validCart}
        setLines={setCart}
        onClose={() => setCartOpen(false)}
      />
    </div>
    </ThemedRoot>
  );
}

function DishModal({ dish, lang, canOrder, onClose, onAdd }: { dish: Dish; lang: Lang; canOrder: boolean; onClose: () => void; onAdd: (qty: number, note: string) => void }) {
  const { t } = useLang();
  const [qty, setQty] = useState(1);
  const [picks, setPicks] = useState<string[]>([]);
  const [free, setFree] = useState("");
  const [full, setFull] = useState<number | null>(null);
  const sub = subtitle(lang, dish);
  const desc = loc(lang, dish.description, dish.description_en);
  // Pilihan cepat dikirim ke dapur dalam bahasa Indonesia; ketikan bebas dikirim apa adanya.
  const note = [...picks, free.trim()].filter(Boolean).join(", ").slice(0, 120);
  const toggleQuick = (idText: string) => setPicks((p) => (p.includes(idText) ? p.filter((x) => x !== idText) : [...p, idText]));

  return (
    <Modal open onClose={onClose} label={dish.name}>
      <div className="dish-media has-gallery">
        <Gallery media={dish.media} name={dish.name} lang={lang} onExpand={dish.media.length ? setFull : undefined} />
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t.close} style={{ position: "absolute", top: 8, right: 8, background: "rgb(20 17 12 / 0.65)", color: "#fff", zIndex: 2 }}>
          <X />
        </button>
      </div>
      <Modal open={full !== null} onClose={() => setFull(null)} label={t.gallery(dish.name)} className="viewer">
        <button type="button" className="icon-btn viewer-close" onClick={() => setFull(null)} aria-label={t.closeFullscreen}>
          <X />
        </button>
        {full !== null && <Gallery media={dish.media} name={dish.name} lang={lang} start={full} fit="contain" />}
      </Modal>
      <div className="stack">
        <div>
          <h2 className="dish-title">{dish.name}</h2>
          {sub && <p className="dish-subtitle">{sub}</p>}
          <div className="row wrap" style={{ marginTop: 8 }}>
            <span className="strong money" style={{ fontSize: "1.15rem" }}>{rupiah(dish.price)}</span>
            {dish.tags.split(",").filter(Boolean).map((tg) => (
              <span key={tg} className="badge">{t.tags[tg] ?? tg}</span>
            ))}
          </div>
        </div>
        {desc && <p style={{ color: "var(--ink-2)" }}>{desc}</p>}
        <DishFacts d={dish} lang={lang} />
        {dish.sold_out ? (
          <div className="banner danger" style={{ margin: 0 }}>{t.soldOutLong}</div>
        ) : canOrder ? (
          <>
            <div className="field">
              <label htmlFor="dish-note">{t.kitchenNote}</label>
              <div className="chips" role="group" aria-label={t.quickNotes}>
                {QUICK_NOTES.map((n) => (
                  <button key={n.id} type="button" className="chip" aria-pressed={picks.includes(n.id)} onClick={() => toggleQuick(n.id)}>
                    {lang === "en" ? n.en : n.id}
                  </button>
                ))}
              </div>
              <input id="dish-note" className="input" value={free} onChange={(e) => setFree(e.target.value)} placeholder={t.kitchenNotePh} maxLength={80} />
            </div>
            <div className="row between">
              <div className="qty" aria-label={t.qty}>
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={t.less}><Minus /></button>
                <span className="num" aria-live="polite">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(dish.few_left ?? 50, q + 1))} aria-label={t.more}><Plus /></button>
              </div>
              <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={() => onAdd(qty, note)}>
                {t.add} · <span className="money">{rupiah(dish.price * qty)}</span>
              </button>
            </div>
          </>
        ) : (
          <p className="small muted">{t.orderAtCashier}</p>
        )}
      </div>
    </Modal>
  );
}

function CartModal({
  open,
  code,
  lang,
  data,
  lines,
  setLines,
  onClose,
}: {
  open: boolean;
  code: string;
  lang: Lang;
  data: MenuData;
  lines: CartLine[];
  setLines: (fn: (c: CartLine[]) => CartLine[]) => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const toast = useToast();
  const nav = useNavigate();
  const [name, setName] = useState(() => loadJSON<string>("mezan-name", ""));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const byId = new Map(data.items.map((i) => [i.id, i]));
  const subtotal = lines.reduce((s, l) => s + byId.get(l.id)!.price * l.qty, 0);
  const service = Math.round((subtotal * data.store.service_rate) / 100);
  const tax = Math.round(((subtotal + service) * data.store.tax_rate) / 100);
  const total = subtotal + service + tax;
  const noteLabel = (n: string) => (lang === "en" ? n.split(",").map((x) => QUICK_NOTES.find((q) => q.id === x.trim())?.en ?? x.trim()).join(", ") : n);

  const change = (idx: number, d: number) =>
    setLines((c) => {
      const valid = c.filter((l) => byId.has(l.id) && !byId.get(l.id)!.sold_out);
      const l = valid[idx];
      if (!l) return c;
      const qty = l.qty + d;
      return qty <= 0 ? valid.filter((_, i) => i !== idx) : valid.map((x, i) => (i === idx ? { ...x, qty: Math.min(50, qty) } : x));
    });

  const send = async () => {
    if (!name.trim()) {
      setNameErr(t.nameNeeded);
      return;
    }
    setBusy(true);
    try {
      saveJSON("mezan-name", name.trim());
      const r = await api.post<{ token: string; number: number }>("/api/public/orders", {
        tableCode: code,
        customerName: name.trim(),
        note,
        lang,
        items: lines.map((l) => ({ id: l.id, qty: l.qty, note: l.note })),
      });
      const mine = loadJSON<{ token: string; number: number; at: number }[]>(ordersKey(code), []);
      saveJSON(ordersKey(code), [...mine.slice(-4), { token: r.token, number: r.number, at: Date.now() }]);
      setLines(() => []);
      onClose();
      nav(`/m/${code}/pesanan/${r.token}`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.orderFor(data.table.label)}
      footer={
        data.store.accepting_orders ? (
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || lines.length === 0} onClick={send}>
            {busy ? t.sending : `${t.send} · ${rupiah(total)}`}
          </button>
        ) : (
          <p className="small muted">{t.showCashier}</p>
        )
      }
    >
      {lines.length === 0 ? (
        <Empty title={t.nothingYet}>{t.tapToAdd}</Empty>
      ) : (
        <div className="stack">
          <div className="cart-lines">
            {lines.map((l, idx) => {
              const d = byId.get(l.id)!;
              const sub = subtitle(lang, d);
              return (
                <div className="cart-line" key={`${l.id}-${l.note}`}>
                  <div style={{ minWidth: 0 }}>
                    <div className="strong">{d.name}</div>
                    {sub && <div className="tiny muted">{sub}</div>}
                    {l.note && <div className="small" style={{ color: "var(--warn-text)" }}>{noteLabel(l.note)}</div>}
                    <div className="small muted money">{rupiah(d.price * l.qty)}</div>
                  </div>
                  <div className="qty">
                    <button onClick={() => change(idx, -1)} aria-label={`${l.qty === 1 ? t.remove : t.less} ${d.name}`}>{l.qty === 1 ? <Trash2 /> : <Minus />}</button>
                    <span className="num">{l.qty}</span>
                    <button onClick={() => change(idx, 1)} aria-label={`${t.more} ${d.name}`}><Plus /></button>
                  </div>
                </div>
              );
            })}
          </div>
          <hr className="divider-dashed" />
          {(service > 0 || tax > 0) && (
            <>
              <div className="sum-row small muted"><span>{t.subtotal}</span><span className="money">{rupiah(subtotal)}</span></div>
              {service > 0 && <div className="sum-row small muted"><span>{t.service} {data.store.service_rate}%</span><span className="money">{rupiah(service)}</span></div>}
              {tax > 0 && <div className="sum-row small muted"><span>{t.tax} {data.store.tax_rate}%</span><span className="money">{rupiah(tax)}</span></div>}
            </>
          )}
          <div className="sum-row total"><span>{t.total}</span><span className="money">{rupiah(total)}</span></div>
          {data.store.accepting_orders && (
            <>
              <Field label={t.yourName} htmlFor="c-name" error={nameErr}>
                <input id="c-name" className="input" value={name} onChange={(e) => { setName(e.target.value); setNameErr(null); }} maxLength={40} autoComplete="given-name" placeholder={t.yourNamePh} />
              </Field>
              <Field label={t.orderNote} htmlFor="c-note">
                <input id="c-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={t.orderNotePh} />
              </Field>
              <p className="small muted">{t.payAtCashier}</p>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
