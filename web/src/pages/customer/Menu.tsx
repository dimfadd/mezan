import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronRight, Clock3, Minus, Play, Plus, Search, Trash2, UtensilsCrossed, X } from "lucide-react";
import { Empty, ErrorState, Field, Loading, Modal, Thumb, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { rupiah } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { TAG_LABEL } from "../store/types";
import { ThemedRoot } from "../../components/ThemedRoot";
import { DEFAULT_THEME, type MenuTheme } from "../../../../shared/menuTheme";

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
}
interface MenuData {
  store: { name: string; address: string; welcome_note: string; tax_rate: number; service_rate: number; accepting_orders: boolean; theme?: MenuTheme };
  table: { label: string; area: string };
  categories: { id: string; name: string }[];
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

export function CustomerMenuPage() {
  const { code = "" } = useParams();
  const { data, error, loading, reload } = useApi<MenuData>(`/api/public/table/${code}`);
  const [cart, setCart] = useState<CartLine[]>(() => loadJSON(cartKey(code), []));
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Dish | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const myOrders = loadJSON<{ token: string; number: number; at: number }[]>(ordersKey(code), []).filter((o) => Date.now() - o.at < 12 * 3600_000);

  useEffect(() => saveJSON(cartKey(code), cart), [cart, code]);
  useEffect(() => {
    if (data) document.title = `${data.store.name} · Menu`;
  }, [data]);

  const byId = useMemo(() => new Map((data?.items ?? []).map((i) => [i.id, i])), [data]);
  // Buang item yang sudah tidak ada/habis dari keranjang lama.
  const validCart = cart.filter((l) => byId.has(l.id) && !byId.get(l.id)!.sold_out);
  const count = validCart.reduce((s, l) => s + l.qty, 0);
  const subtotal = validCart.reduce((s, l) => s + byId.get(l.id)!.price * l.qty, 0);

  const sections = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    const match = (i: Dish) => !s || i.name.toLowerCase().includes(s) || i.description.toLowerCase().includes(s);
    const list = data.categories.map((c) => ({ id: c.id, name: c.name, items: data.items.filter((i) => i.category_id === c.id && match(i)) }));
    const none = data.items.filter((i) => (!i.category_id || !data.categories.some((c) => c.id === i.category_id)) && match(i));
    if (none.length) list.push({ id: "lain", name: "Lainnya", items: none });
    return list.filter((x) => x.items.length > 0);
  }, [data, q]);

  const addLine = (id: string, qty: number, note: string) => {
    setCart((c) => {
      const ex = c.find((l) => l.id === id && l.note === note);
      if (ex) return c.map((l) => (l === ex ? { ...l, qty: Math.min(50, l.qty + qty) } : l));
      return [...c, { id, qty, note }];
    });
  };

  if (error) {
    return (
      <div className="cust">
        <ErrorState message={error.message} onRetry={error.status === 404 ? undefined : () => reload()} />
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
  return (
    <ThemedRoot theme={theme}>
    <div className="cust">
      <header className="cust-head">
        {theme.logo && <img className="cust-logo" src={theme.logo} alt={`Logo ${data.store.name}`} />}
        <span className="table-tag">
          <UtensilsCrossed aria-hidden="true" /> {data.table.label}
          {data.table.area && ` · ${data.table.area}`}
        </span>
        <h1 className="store">{data.store.name}</h1>
        {data.store.welcome_note && <p className="muted">{data.store.welcome_note}</p>}
        {!data.store.accepting_orders && (
          <div className="banner info" style={{ margin: "8px 0 0" }}>
            <Clock3 aria-hidden="true" />
            <div>Saat ini pesanan lewat HP belum dibuka. Silakan lihat menu, lalu pesan ke kasir atau pelayan.</div>
          </div>
        )}
        {myOrders.length > 0 && (
          <Link className="btn btn-sm" style={{ justifySelf: "start", marginTop: 6 }} to={`/m/${code}/pesanan/${myOrders[myOrders.length - 1].token}`}>
            Lihat status pesanan #{myOrders[myOrders.length - 1].number} <ChevronRight />
          </Link>
        )}
      </header>

      <nav className="cust-nav" aria-label="Kategori menu">
        <div className="cust-search">
          <Search aria-hidden="true" />
          <input className="input" type="search" placeholder="Cari menu" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari menu" />
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
        <Empty title={q ? "Menu tidak ditemukan" : "Menu belum diisi"}>{q ? `Tidak ada menu yang cocok dengan "${q}".` : "Toko ini belum memasukkan menu."}</Empty>
      ) : (
        sections.map((s) => (
          <section key={s.id} id={`sec-${s.id}`} className="cust-section" aria-labelledby={`h-${s.id}`}>
            <h2 id={`h-${s.id}`}>{s.name}</h2>
            <div className="dish-list">
              {s.items.map((d) => {
                const inCart = validCart.filter((l) => l.id === d.id).reduce((n, l) => n + l.qty, 0);
                return (
                  <button key={d.id} className={`dish${d.sold_out ? " sold" : ""}`} onClick={() => setOpen(d)} aria-label={`${d.name}, ${rupiah(d.price)}${d.sold_out ? ", habis" : ""}. Lihat detail`}>
                    {inCart > 0 && <span className="count added">{inCart}</span>}
                    <div style={{ minWidth: 0 }}>
                      <div className="name">{d.name}</div>
                      {d.description && <div className="desc">{d.description}</div>}
                      <div className="price">{rupiah(d.price)}</div>
                      <div className="tags">
                        {d.sold_out && <span className="badge badge-danger">Habis</span>}
                        {d.few_left != null && <span className="badge badge-warn">Tinggal {d.few_left}</span>}
                        {d.tags.split(",").filter(Boolean).map((t) => (
                          <span key={t} className={`badge ${t === "pedas" ? "badge-danger" : t === "favorit" ? "badge-new" : ""}`}>{TAG_LABEL[t] ?? t}</span>
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
                      {d.video_url && (
                        <span className="play">
                          <Play aria-hidden="true" /> Video
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
            {count} item · <span className="money">{rupiah(subtotal)}</span>
          </span>
          <span className="go">
            {data.store.accepting_orders ? "Lihat pesanan" : "Lihat pilihan"} <ChevronRight aria-hidden="true" />
          </span>
        </button>
      )}

      {open && <DishModal dish={open} canOrder={data.store.accepting_orders} onClose={() => setOpen(null)} onAdd={(qty, note) => { addLine(open.id, qty, note); setOpen(null); }} />}
      <CartModal
        open={cartOpen}
        code={code}
        data={data}
        lines={validCart}
        setLines={setCart}
        onClose={() => setCartOpen(false)}
      />
    </div>
    </ThemedRoot>
  );
}

function DishModal({ dish, canOrder, onClose, onAdd }: { dish: Dish; canOrder: boolean; onClose: () => void; onAdd: (qty: number, note: string) => void }) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [view, setView] = useState<"video" | "image">(dish.video_url ? "video" : "image");
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <Modal open onClose={onClose} label={dish.name}>
      <div className="dish-media">
        {view === "video" && dish.video_url ? (
          <video
            ref={videoRef}
            src={dish.video_url}
            poster={dish.image_url ?? undefined}
            muted
            loop
            playsInline
            autoPlay={!reduce}
            controls
            preload="auto"
            aria-label={`Video ${dish.name}`}
          />
        ) : dish.image_url ? (
          <img src={dish.image_url} alt={dish.name} />
        ) : (
          <Thumb name={dish.name} />
        )}
        {dish.video_url && dish.image_url && (
          <div className="media-switch" role="group" aria-label="Pilih tampilan">
            <button type="button" aria-pressed={view === "video"} onClick={() => setView("video")}>Video</button>
            <button type="button" aria-pressed={view === "image"} onClick={() => setView("image")}>Foto</button>
          </div>
        )}
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup" style={{ position: "absolute", top: 8, right: 8, background: "rgb(20 17 12 / 0.65)", color: "#fff" }}>
          <X />
        </button>
      </div>
      <div className="stack">
        <div>
          <h2 className="dish-title">{dish.name}</h2>
          <div className="row wrap" style={{ marginTop: 8 }}>
            <span className="strong money" style={{ fontSize: "1.15rem" }}>{rupiah(dish.price)}</span>
            {dish.tags.split(",").filter(Boolean).map((t) => (
              <span key={t} className="badge">{TAG_LABEL[t] ?? t}</span>
            ))}
          </div>
        </div>
        {dish.description && <p style={{ color: "var(--ink-2)" }}>{dish.description}</p>}
        {dish.sold_out ? (
          <div className="banner danger" style={{ margin: 0 }}>Menu ini sedang habis.</div>
        ) : canOrder ? (
          <>
            <Field label="Catatan untuk dapur (opsional)" htmlFor="dish-note">
              <input id="dish-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mis. tidak pedas, tanpa bawang" maxLength={120} />
            </Field>
            <div className="row between">
              <div className="qty" aria-label="Jumlah">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Kurangi"><Minus /></button>
                <span className="num" aria-live="polite">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(dish.few_left ?? 50, q + 1))} aria-label="Tambah"><Plus /></button>
              </div>
              <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={() => onAdd(qty, note.trim())}>
                Tambah · <span className="money">{rupiah(dish.price * qty)}</span>
              </button>
            </div>
          </>
        ) : (
          <p className="small muted">Pesan menu ini langsung ke kasir atau pelayan.</p>
        )}
      </div>
    </Modal>
  );
}

function CartModal({
  open,
  code,
  data,
  lines,
  setLines,
  onClose,
}: {
  open: boolean;
  code: string;
  data: MenuData;
  lines: CartLine[];
  setLines: (fn: (c: CartLine[]) => CartLine[]) => void;
  onClose: () => void;
}) {
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
      setNameErr("Isi nama supaya pelayan tahu pesanan ini milik siapa.");
      return;
    }
    setBusy(true);
    try {
      saveJSON("mezan-name", name.trim());
      const r = await api.post<{ token: string; number: number }>("/api/public/orders", {
        tableCode: code,
        customerName: name.trim(),
        note,
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
      title={`Pesanan ${data.table.label}`}
      footer={
        data.store.accepting_orders ? (
          <button className="btn btn-primary btn-lg btn-block" disabled={busy || lines.length === 0} onClick={send}>
            {busy ? "Mengirim..." : `Kirim pesanan · ${rupiah(total)}`}
          </button>
        ) : (
          <p className="small muted">Tunjukkan daftar ini ke kasir untuk memesan.</p>
        )
      }
    >
      {lines.length === 0 ? (
        <Empty title="Belum ada pilihan">Ketuk menu untuk menambahkan.</Empty>
      ) : (
        <div className="stack">
          <div className="cart-lines">
            {lines.map((l, idx) => {
              const d = byId.get(l.id)!;
              return (
                <div className="cart-line" key={`${l.id}-${l.note}`}>
                  <div style={{ minWidth: 0 }}>
                    <div className="strong">{d.name}</div>
                    {l.note && <div className="small" style={{ color: "var(--warn-text)" }}>{l.note}</div>}
                    <div className="small muted money">{rupiah(d.price * l.qty)}</div>
                  </div>
                  <div className="qty">
                    <button onClick={() => change(idx, -1)} aria-label={l.qty === 1 ? `Hapus ${d.name}` : `Kurangi ${d.name}`}>{l.qty === 1 ? <Trash2 /> : <Minus />}</button>
                    <span className="num">{l.qty}</span>
                    <button onClick={() => change(idx, 1)} aria-label={`Tambah ${d.name}`}><Plus /></button>
                  </div>
                </div>
              );
            })}
          </div>
          <hr className="divider-dashed" />
          {(service > 0 || tax > 0) && (
            <>
              <div className="sum-row small muted"><span>Subtotal</span><span className="money">{rupiah(subtotal)}</span></div>
              {service > 0 && <div className="sum-row small muted"><span>Service {data.store.service_rate}%</span><span className="money">{rupiah(service)}</span></div>}
              {tax > 0 && <div className="sum-row small muted"><span>Pajak {data.store.tax_rate}%</span><span className="money">{rupiah(tax)}</span></div>}
            </>
          )}
          <div className="sum-row total"><span>Total</span><span className="money">{rupiah(total)}</span></div>
          {data.store.accepting_orders && (
            <>
              <Field label="Nama kamu" htmlFor="c-name" error={nameErr}>
                <input id="c-name" className="input" value={name} onChange={(e) => { setName(e.target.value); setNameErr(null); }} maxLength={40} autoComplete="given-name" placeholder="Mis. Andi" />
              </Field>
              <Field label="Catatan pesanan (opsional)" htmlFor="c-note">
                <input id="c-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Mis. minta sendok tambahan" />
              </Field>
              <p className="small muted">Pembayaran dilakukan di kasir. Pesanan baru dibuat setelah kasir menerimanya.</p>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
