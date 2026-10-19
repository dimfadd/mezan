import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BellRing, ChevronRight, Clock3, Images, ReceiptText, Users, LayoutGrid, List, MapPin, Minus, Play, Plus, Search, ShoppingBag, ThumbsUp, Trash2, UtensilsCrossed, X, Clapperboard, Sparkles } from "lucide-react";
import { priceNow, useStoreClock, type PriceNow } from "../../lib/pricing";
import { scheduleText, type PriceRule } from "../../../../shared/schedule";
import { VideoFeed } from "./VideoFeed";
import { Empty, ErrorState, Field, Loading, Modal, Thumb, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { rupiah } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { LangSwitch, useLang } from "../../lib/lang";
import { LegalFoot } from "../public/Legal";
import { ThemedRoot } from "../../components/ThemedRoot";
import { Gallery, mediaSummary, type MediaRef } from "../../components/Gallery";
import { DishFacts } from "../../components/DishInfo";
import { DEFAULT_THEME, type MenuTheme } from "../../../../shared/menuTheme";
import { loc, QUICK_NOTES, type Lang } from "../../../../shared/i18n";
import { useTableSession, type CartLine, type SharedLine, type TableState } from "./tableSession";

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
  avail_days: number;
  avail_from: number | null;
  avail_to: number | null;
  pairs?: string[];
}
interface MenuData {
  store: { name: string; address: string; welcome_note: string; welcome_note_en: string; tax_rate: number; service_rate: number; accepting_orders: boolean; theme?: MenuTheme };
  mode: "dine_in" | "takeaway";
  table: { label: string; area: string } | null;
  geo: { check: boolean; strict: boolean };
  categories: { id: string; name: string; name_en: string }[];
  items: Dish[];
  pricing?: { tz: number; now: number; rules: PriceRule[] };
}

/** Harga & jam buka menu saat ini, dihitung dari jam toko. */
export type Priced = (d: Dish) => PriceNow;
export type { Dish };

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

const VIEW_KEY = "pesanin-view";
const isBest = (d: Dish) => d.tags.split(",").includes("bestseller");

/** Lokasi HP sekali ambil. Gagal / ditolak = null; server yang memutuskan boleh atau tidak. */
function getLocation(): Promise<{ lat: number; lng: number; acc: number } | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/** Keterangan Inggris di bawah nama asli. Nama asli tetap utama supaya pelayan paham saat disebut. */
const subtitle = (lang: Lang, d: Dish) => (lang === "en" && d.name_en && d.name_en !== d.name ? d.name_en : null);

export function CustomerMenuPage() {
  const { code = "" } = useParams();
  const { lang, setLang, t } = useLang();
  const { data, error, loading, reload } = useApi<MenuData>(`/api/public/table/${code}?lang=${lang}`);
  const toast = useToast();
  const dineIn = !!data?.table;
  // Meja: keranjang bersama di server (pesan bareng). Bawa pulang: keranjang di HP saja.
  const session = useTableSession(code, dineIn, lang, (m) => toast(m, "error"));
  const [localCart, setLocalCart] = useState<CartLine[]>(() => loadJSON(cartKey(code), []));
  const cart = dineIn ? session.mine : localCart;
  const setCart = dineIn ? session.setMine : setLocalCart;
  const [callOpen, setCallOpen] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Dish | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  // Pilihan tampilan pembeli disimpan di HP-nya; kalau belum pernah memilih, ikut pilihan toko.
  const [view, setView] = useState<"list" | "grid" | null>(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      return v === "list" || v === "grid" ? v : null;
    } catch {
      return null;
    }
  });
  // Mode video ala TikTok tidak disimpan: dibuka saat diminta, ditutup kembali ke daftar.
  const [video, setVideo] = useState(false);
  const pickView = (v: "list" | "grid") => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* mode privat */
    }
  };
  const clock = useStoreClock(data?.pricing);
  const rules = data?.pricing?.rules ?? [];
  const priced: Priced = (d) => priceNow(d, rules, clock);
  const orderable = (d: Dish) => !d.sold_out && priced(d).open;
  const myOrders = loadJSON<{ token: string; number: number; at: number }[]>(ordersKey(code), []).filter((o) => Date.now() - o.at < 12 * 3600_000);

  useEffect(() => {
    if (!dineIn) saveJSON(cartKey(code), localCart);
  }, [dineIn, localCart, code]);
  const st = session.state;
  const othersLines = (st?.lines ?? []).filter((l) => !l.mine);
  useEffect(() => session.setFast(cartOpen || callOpen || othersLines.length > 0 || (st?.calls.length ?? 0) > 0), [cartOpen, callOpen, othersLines.length, st?.calls.length, session]);

  // Kabar dari meja: pesanan dikirim teman semeja, panggilan sudah ditanggapi.
  const seenOrders = useRef<Set<string> | null>(null);
  const prevCalls = useRef<string[]>([]);
  useEffect(() => {
    if (!st) return;
    const tokens = new Set(st.orders.map((o) => o.token));
    const mineTokens = new Set(myOrders.map((o) => o.token));
    if (seenOrders.current) {
      const fresh = st.orders.find((o) => !seenOrders.current!.has(o.token) && !mineTokens.has(o.token));
      if (fresh) toast(t.groupSent(fresh.number, fresh.name));
    }
    seenOrders.current = tokens;
    const kinds = st.calls.map((c) => c.kind);
    if (prevCalls.current.some((k) => !kinds.includes(k as "waiter" | "bill") && !cancelledCall.current.has(k))) toast(t.callDone);
    cancelledCall.current.clear();
    prevCalls.current = kinds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st]);
  const cancelledCall = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (data) document.title = `${data.store.name} · ${t.menu}`;
  }, [data, t]);

  const byId = useMemo(() => new Map((data?.items ?? []).map((i) => [i.id, i])), [data]);
  // Buang item yang sudah tidak ada/habis dari keranjang lama.
  const validCart = cart.filter((l) => byId.has(l.id) && orderable(byId.get(l.id)!));
  const validOthers = othersLines.filter((l) => byId.has(l.item_id) && orderable(byId.get(l.item_id)!));
  const count = validCart.reduce((s, l) => s + l.qty, 0) + validOthers.reduce((s, l) => s + l.qty, 0);
  const subtotal = validCart.reduce((s, l) => s + priced(byId.get(l.id)!).price * l.qty, 0) + validOthers.reduce((s, l) => s + priced(byId.get(l.item_id)!).price * l.qty, 0);
  const hasMedia = (data?.items ?? []).some((i) => i.media.length > 0 || i.image_url || i.video_url);

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

  const baseTheme = data.store.theme ?? DEFAULT_THEME;
  const layout = view ?? baseTheme.layout;
  const theme = { ...baseTheme, layout };
  const welcome = loc(lang, data.store.welcome_note, data.store.welcome_note_en);
  const placeTag = data.table ? (
    <span className="table-tag">
      <UtensilsCrossed aria-hidden="true" /> {data.table.label}
      {data.table.area && ` · ${data.table.area}`}
    </span>
  ) : (
    <span className="table-tag">
      <ShoppingBag aria-hidden="true" /> {t.takeawayTag}
    </span>
  );
  return (
    <ThemedRoot theme={theme}>
    <div className="cust">
      <header className="cust-head">
        <div className="cust-top">
          {theme.logo ? <img className="cust-logo" src={theme.logo} alt={`Logo ${data.store.name}`} /> : placeTag}
          <div className="row" style={{ gap: 6 }}>
            {dineIn && (
              <button type="button" className={`call-btn${st?.calls.length ? " on" : ""}`} onClick={() => setCallOpen(true)}>
                <BellRing aria-hidden="true" /> {t.callStaff}
              </button>
            )}
            <LangSwitch lang={lang} setLang={setLang} />
          </div>
        </div>
        {theme.logo && placeTag}
        <h1 className="store">{data.store.name}</h1>
        {welcome && <p className="muted">{welcome}</p>}
        {!data.store.accepting_orders && (
          <div className="banner info" style={{ margin: "8px 0 0" }}>
            <Clock3 aria-hidden="true" />
            <div>{t.notOpen}</div>
          </div>
        )}
        {st && st.calls.length > 0 && (
          <div className="banner info" role="status" style={{ margin: "8px 0 0" }}>
            <BellRing aria-hidden="true" />
            <div>{st.calls.some((c) => c.kind === "waiter") ? t.callWaiting : t.callBillWaiting}</div>
          </div>
        )}
        {(() => {
          // Pesanan terakhir meja ini (siapa pun pengirimnya), atau pesanan HP ini sendiri.
          const last = st?.orders[0] ?? (myOrders.length ? { token: myOrders[myOrders.length - 1].token, number: myOrders[myOrders.length - 1].number } : null);
          return last ? (
            <Link className="btn btn-sm" style={{ justifySelf: "start", marginTop: 6 }} to={`/m/${code}/pesanan/${last.token}`}>
              {t.seeStatus} #{last.number} <ChevronRight />
            </Link>
          ) : null;
        })()}
      </header>

      <nav className="cust-nav" aria-label={t.menu}>
        <div className="cust-tools">
          <div className="cust-search">
            <Search aria-hidden="true" />
            <input className="input" type="search" placeholder={t.search} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t.search} />
          </div>
          <div className="view-toggle" role="group" aria-label={t.viewAs}>
            <button type="button" aria-pressed={layout === "list"} onClick={() => pickView("list")} aria-label={t.listView} title={t.listView}>
              <List aria-hidden="true" />
            </button>
            <button type="button" aria-pressed={layout === "grid"} onClick={() => pickView("grid")} aria-label={t.gridView} title={t.gridView}>
              <LayoutGrid aria-hidden="true" />
            </button>
            {hasMedia && (
              <button type="button" aria-pressed={video} onClick={() => setVideo(true)} aria-label={t.videoView} title={t.videoView}>
                <Clapperboard aria-hidden="true" />
              </button>
            )}
          </div>
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
                const p = priced(d);
                return (
                  <button key={d.id} className={`dish${d.sold_out || !p.open ? " sold" : ""}`} onClick={() => setOpen(d)} aria-label={`${d.name}${sub ? `, ${sub}` : ""}, ${rupiah(p.price)}${p.promo ? `, ${p.promo}` : ""}${isBest(d) ? `, ${t.bestSeller}` : ""}${d.sold_out ? `, ${t.soldOut}` : !p.open ? `, ${t.availableAt(scheduleText(d, lang))}` : ""}. ${t.seeDetail}`}>
                    {inCart > 0 && <span className="count added">{inCart}</span>}
                    <div style={{ minWidth: 0 }}>
                      <div className="name">{d.name}</div>
                      {sub && <div className="name-en">{sub}</div>}
                      {desc && <div className="desc">{desc}</div>}
                      <div className="price">
                        {p.promo && <s className="was">{rupiah(p.list)}</s>} {rupiah(p.price)}
                        {p.promo && <span className="promo-tag">{p.promo} −{p.percent}%</span>}
                      </div>
                      <div className="tags">
                        {d.sold_out && <span className="badge badge-danger">{t.soldOut}</span>}
                        {!d.sold_out && !p.open && <span className="badge"><Clock3 aria-hidden="true" /> {t.availableAt(scheduleText(d, lang))}</span>}
                        {d.few_left != null && <span className="badge badge-warn">{t.fewLeft(d.few_left)}</span>}
                        {d.tags.split(",").filter((tg) => tg && tg !== "bestseller").map((tg) => (
                          <span key={tg} className={`badge ${tg === "pedas" ? "badge-danger" : tg === "favorit" ? "badge-ok" : ""}`}>{t.tags[tg] ?? tg}</span>
                        ))}
                      </div>
                    </div>
                    <div className="media">
                      {isBest(d) && (
                        <span className="stamp-best">
                          <ThumbsUp aria-hidden="true" /> {t.bestSeller}
                        </span>
                      )}
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

      <LegalFoot compact en={lang === "en"} />

      {count > 0 && (
        <button className="cartbar" onClick={() => setCartOpen(true)}>
          <span>
            {validOthers.length ? <><Users aria-hidden="true" className="cartbar-ico" /> {t.tableItems(count)}</> : t.items(count)} · <span className="money">{rupiah(subtotal)}</span>
          </span>
          <span className="go">
            {data.store.accepting_orders ? t.viewOrder : t.viewChoices} <ChevronRight aria-hidden="true" />
          </span>
        </button>
      )}

      {open && (
        <DishModal
          dish={open}
          lang={lang}
          canOrder={data.store.accepting_orders}
          priced={priced}
          pairs={(open.pairs ?? []).map((id) => byId.get(id)).filter((x): x is Dish => !!x && orderable(x))}
          onClose={() => setOpen(null)}
          onAdd={(qty, note) => { addLine(open.id, qty, note); setOpen(null); }}
          onAddPair={(d) => { addLine(d.id, 1, ""); toast(t.added(d.name)); }}
        />
      )}
      {video && (
        <VideoFeed
          items={sections.flatMap((x) => x.items).filter((i) => i.media.length > 0 || i.image_url || i.video_url)}
          lang={lang}
          priced={priced}
          canOrder={data.store.accepting_orders}
          count={count}
          onAdd={(d) => { addLine(d.id, 1, ""); toast(t.added(d.name)); }}
          onOpen={(d) => { setVideo(false); setOpen(d); }}
          onCart={() => { setVideo(false); setCartOpen(true); }}
          onClose={() => setVideo(false)}
        />
      )}
      <CartModal
        open={cartOpen}
        code={code}
        lang={lang}
        data={data}
        lines={validCart}
        setLines={setCart}
        others={validOthers}
        priced={priced}
        suggest={(() => {
          const inCart = new Set([...validCart.map((l) => l.id), ...validOthers.map((l) => l.item_id)]);
          const out: Dish[] = [];
          for (const id of [...inCart]) for (const pid of byId.get(id)?.pairs ?? []) {
            const x = byId.get(pid);
            if (x && !inCart.has(pid) && orderable(x) && !out.includes(x)) out.push(x);
          }
          return out.slice(0, 3);
        })()}
        onAddPair={(d) => addLine(d.id, 1, "")}
        people={st?.people ?? 0}
        session={dineIn ? session : null}
        onClose={() => setCartOpen(false)}
      />
      {dineIn && (
        <CallSheet
          open={callOpen}
          code={code}
          lang={lang}
          geo={data.geo}
          calls={st?.calls ?? []}
          onClose={() => setCallOpen(false)}
          onChanged={(cancelled) => {
            if (cancelled) cancelledCall.current.add(cancelled);
            session.refresh();
          }}
        />
      )}
    </div>
    </ThemedRoot>
  );
}

function DishModal({
  dish,
  lang,
  canOrder,
  priced,
  pairs,
  onClose,
  onAdd,
  onAddPair,
}: {
  dish: Dish;
  lang: Lang;
  canOrder: boolean;
  priced: Priced;
  pairs: Dish[];
  onClose: () => void;
  onAdd: (qty: number, note: string) => void;
  onAddPair: (d: Dish) => void;
}) {
  const p = priced(dish);
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
            <span className="strong money" style={{ fontSize: "1.15rem" }}>
              {p.promo && <s className="was">{rupiah(p.list)}</s>} {rupiah(p.price)}
            </span>
            {p.promo && <span className="promo-tag">{p.promo} −{p.percent}%</span>}
            {dish.tags.split(",").filter(Boolean).map((tg) =>
              tg === "bestseller" ? (
                <span key={tg} className="badge badge-best"><ThumbsUp aria-hidden="true" /> {t.bestSeller}</span>
              ) : (
                <span key={tg} className="badge">{t.tags[tg] ?? tg}</span>
              ),
            )}
          </div>
        </div>
        {desc && <p style={{ color: "var(--ink-2)" }}>{desc}</p>}
        <DishFacts d={dish} lang={lang} />
        {dish.sold_out ? (
          <div className="banner danger" style={{ margin: 0 }}>{t.soldOutLong}</div>
        ) : !p.open ? (
          <div className="banner info" style={{ margin: 0 }}><Clock3 aria-hidden="true" /> {t.availableAt(scheduleText(dish, lang))}</div>
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
                {t.add} · <span className="money">{rupiah(p.price * qty)}</span>
              </button>
            </div>
            {pairs.length > 0 && <PairChips title={t.goesWith} items={pairs} lang={lang} priced={priced} onAdd={onAddPair} />}
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
  others,
  priced,
  suggest,
  onAddPair,
  people,
  session,
  onClose,
}: {
  open: boolean;
  code: string;
  lang: Lang;
  data: MenuData;
  lines: CartLine[];
  setLines: (fn: (c: CartLine[]) => CartLine[]) => void;
  others: SharedLine[];
  priced: Priced;
  suggest: Dish[];
  onAddPair: (d: Dish) => void;
  people: number;
  session: ReturnType<typeof useTableSession> | null;
  onClose: () => void;
}) {
  const { t } = useLang();
  const toast = useToast();
  const nav = useNavigate();
  const [name, setName] = useState(() => loadJSON<string>("mezan-name", ""));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const byId = new Map(data.items.map((i) => [i.id, i]));
  const group = !!session;
  useEffect(() => {
    session?.setPerson(name.trim());
  }, [name, session]);
  const subtotal = lines.reduce((s, l) => s + priced(byId.get(l.id)!).price * l.qty, 0) + others.reduce((s, l) => s + priced(byId.get(l.item_id)!).price * l.qty, 0);
  const service = Math.round((subtotal * data.store.service_rate) / 100);
  const tax = Math.round(((subtotal + service) * data.store.tax_rate) / 100);
  const total = subtotal + service + tax;
  const noteLabel = (n: string) => (lang === "en" ? n.split(",").map((x) => QUICK_NOTES.find((q) => q.id === x.trim())?.en ?? x.trim()).join(", ") : n);

  const change = (idx: number, d: number) =>
    setLines((c) => {
      const valid = c.filter((l) => byId.has(l.id) && !byId.get(l.id)!.sold_out && priced(byId.get(l.id)!).open);
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
      let where = null;
      if (data.geo.check) {
        setLocating(true);
        where = await getLocation();
        setLocating(false);
      }
      if (session) {
        session.setPerson(name.trim());
        await session.flush(); // pastikan pilihan terakhir HP ini sudah sampai sebelum meja dikirim
      }
      const r = await api.post<{ token: string; number: number }>("/api/public/orders", {
        tableCode: code,
        customerName: name.trim(),
        note,
        lang,
        loc: where,
        ...(group ? { group: true } : { items: lines.map((l) => ({ id: l.id, qty: l.qty, note: l.note })) }),
      });
      const mine = loadJSON<{ token: string; number: number; at: number }[]>(ordersKey(code), []);
      saveJSON(ordersKey(code), [...mine.slice(-4), { token: r.token, number: r.number, at: Date.now() }]);
      if (session) session.reset();
      else setLines(() => []);
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
      title={data.table ? t.orderFor(data.table.label) : t.orderTakeaway}
      footer={
        data.store.accepting_orders ? (
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || (lines.length === 0 && others.length === 0)} onClick={send}>
            {locating ? t.locChecking : busy ? t.sending : `${group && others.length ? t.sendTable : t.send} · ${rupiah(total)}`}
          </button>
        ) : (
          <p className="small muted">{t.showCashier}</p>
        )
      }
    >
      {lines.length === 0 && others.length === 0 ? (
        <div className="stack">
          <Empty title={t.nothingYet}>{t.tapToAdd}</Empty>
          {group && <p className="small muted" style={{ textAlign: "center" }}>{t.groupHint}</p>}
        </div>
      ) : (
        <div className="stack">
          {group && (
            <p className="small muted group-note">
              <Users aria-hidden="true" /> {people > 1 ? `${t.groupPeople(people)}. ` : ""}{t.groupHint}
            </p>
          )}
          {group && others.length > 0 && lines.length > 0 && <div className="person-h">{t.you}{name.trim() ? ` (${name.trim()})` : ""}</div>}
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
                    <div className="small muted money">{rupiah(priced(d).price * l.qty)}</div>
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
          {group && <OthersLines others={others} byId={byId} lang={lang} priced={priced} noteLabel={noteLabel} onRemove={(id) => session!.removeLine(id)} />}
          {data.store.accepting_orders && suggest.length > 0 && <PairChips title={t.addPair} items={suggest} lang={lang} priced={priced} onAdd={onAddPair} />}
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
              <p className="small muted">{data.table ? t.payAtCashier : t.payTakeaway}</p>
              {data.geo.check && (
                <p className="small muted loc-note">
                  <MapPin aria-hidden="true" /> {t.locWhy}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

function OthersLines({ others, byId, lang, priced, noteLabel, onRemove }: { others: SharedLine[]; byId: Map<string, Dish>; lang: Lang; priced: Priced; noteLabel: (n: string) => string; onRemove: (id: string) => void }) {
  const { t } = useLang();
  if (others.length === 0) return null;
  const groups = new Map<string, SharedLine[]>();
  for (const l of others) {
    const k = l.person || t.guest;
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }
  return (
    <>
      {[...groups].map(([who, ls]) => (
        <div key={who}>
          <div className="person-h">{who}</div>
          <div className="cart-lines">
            {ls.map((l) => {
              const d = byId.get(l.item_id)!;
              const sub = subtitle(lang, d);
              return (
                <div className="cart-line" key={l.id}>
                  <div style={{ minWidth: 0 }}>
                    <div className="strong">{l.qty}× {d.name}</div>
                    {sub && <div className="tiny muted">{sub}</div>}
                    {l.note && <div className="small" style={{ color: "var(--warn-text)" }}>{noteLabel(l.note)}</div>}
                    <div className="small muted money">{rupiah(priced(d).price * l.qty)}</div>
                  </div>
                  <button type="button" className="icon-btn" onClick={() => onRemove(l.id)} aria-label={`${t.remove} ${d.name} (${who})`}>
                    <Trash2 />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function CallSheet({
  open,
  code,
  lang,
  geo,
  calls,
  onClose,
  onChanged,
}: {
  open: boolean;
  code: string;
  lang: Lang;
  geo: MenuData["geo"];
  calls: TableState["calls"];
  onClose: () => void;
  onChanged: (cancelledKind?: string) => void;
}) {
  const { t } = useLang();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const call = async (kind: "waiter" | "bill") => {
    setBusy(kind);
    try {
      const where = geo.check ? await getLocation() : null;
      await api.post(`/api/public/table/${code}/calls`, { kind, lang, loc: where });
      onChanged();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };
  const cancel = async (kind: string) => {
    try {
      await api.del(`/api/public/table/${code}/calls/${kind}`);
      onChanged(kind);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const opts = [
    { kind: "waiter" as const, icon: <BellRing aria-hidden="true" />, title: t.callWaiter, sub: t.callWaiterSub },
    { kind: "bill" as const, icon: <ReceiptText aria-hidden="true" />, title: t.callBill, sub: t.callBillSub },
  ];
  return (
    <Modal open={open} onClose={onClose} title={t.callTitle}>
      <div className="stack">
        {opts.map((o) => {
          const pending = calls.find((c) => c.kind === o.kind);
          return (
            <div key={o.kind} className={`call-opt${pending ? " pending" : ""}`}>
              <button type="button" disabled={!!pending || busy !== null} onClick={() => call(o.kind)}>
                <span className="ico">{o.icon}</span>
                <span>
                  <span className="t">{o.title}</span>
                  <span className="s">{pending ? t.callSent(Math.floor((Date.now() - pending.created_at) / 60000)) : busy === o.kind ? t.sending : o.sub}</span>
                </span>
              </button>
              {pending && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => cancel(o.kind)}>
                  {t.callCancel}
                </button>
              )}
            </div>
          );
        })}
        {geo.check && (
          <p className="small muted loc-note">
            <MapPin aria-hidden="true" /> {t.locWhy}
          </p>
        )}
      </div>
    </Modal>
  );
}

/** Saran pelengkap: diambil dari pilihan pemilik, atau dari yang sering dipesan bersama. */
function PairChips({ title, items, lang, priced, onAdd }: { title: string; items: Dish[]; lang: Lang; priced: Priced; onAdd: (d: Dish) => void }) {
  return (
    <div className="pair-box">
      <span className="small strong"><Sparkles aria-hidden="true" /> {title}</span>
      <div className="pair-row">
        {items.map((d) => (
          <button key={d.id} type="button" className="pair-chip" onClick={() => onAdd(d)}>
            <span className="ph">{d.image_url ? <img src={d.image_url} alt="" loading="lazy" /> : <Thumb name={d.name} />}</span>
            <span className="tx">
              <span className="nm">{d.name}{lang === "en" && d.name_en && d.name_en !== d.name ? <span className="tiny muted"> · {d.name_en}</span> : null}</span>
              <span className="money small">+{rupiah(priced(d).price)}</span>
            </span>
            <Plus aria-hidden="true" className="add" />
          </button>
        ))}
      </div>
    </div>
  );
}
