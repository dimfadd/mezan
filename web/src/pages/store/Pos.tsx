import { useMemo, useState } from "react";
import { Minus, Plus, Search, Trash2, ChevronUp } from "lucide-react";
import { Empty, ErrorState, Loading, Modal, PageHead, Segmented, Thumb, useToast } from "../../components/ui";
import { PaymentModal, type PayMethod } from "../../components/PaymentModal";
import { api } from "../../lib/api";
import { rupiah } from "../../lib/format";
import { useApi, useMediaQuery } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { useOrderFeed } from "../../components/Shell";
import type { Category, DiningTable, MenuItem } from "./types";

interface Line {
  key: string;
  item: MenuItem;
  qty: number;
  note: string;
}

export function PosPage() {
  const { tenant } = useSession();
  const toast = useToast();
  const feed = useOrderFeed();
  const items = useApi<{ items: MenuItem[] }>("/api/store/items");
  const cats = useApi<{ categories: Category[] }>("/api/store/categories");
  const tables = useApi<{ tables: DiningTable[] }>("/api/store/tables");
  const narrow = useMediaQuery("(max-width: 799px)");
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in");
  const [tableId, setTableId] = useState<string>("");
  const [name, setName] = useState("");
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [noteFor, setNoteFor] = useState<Line | null>(null);
  const [noteText, setNoteText] = useState("");

  const stockOn = !!tenant?.inventory_enabled;
  const list = useMemo(() => {
    const all = items.data?.items ?? [];
    const s = q.trim().toLowerCase();
    return all.filter((i) => (cat === "all" || i.category_id === cat) && (!s || i.name.toLowerCase().includes(s)));
  }, [items.data, cat, q]);

  const subtotal = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const service = Math.round((subtotal * (tenant?.service_rate ?? 0)) / 100);
  const tax = Math.round(((subtotal + service) * (tenant?.tax_rate ?? 0)) / 100);
  const total = subtotal + service + tax;
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const qtyInCart = (id: string) => lines.filter((l) => l.item.id === id).reduce((s, l) => s + l.qty, 0);
  const soldOut = (i: MenuItem) => !i.available || (stockOn && !!i.track_stock && i.stock_qty - qtyInCart(i.id) <= 0);

  const add = (item: MenuItem) => {
    if (soldOut(item)) return;
    setLines((ls) => {
      const ex = ls.find((l) => l.item.id === item.id && l.note === "");
      if (ex) return ls.map((l) => (l === ex ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { key: `${item.id}-${Date.now()}`, item, qty: 1, note: "" }];
    });
  };
  const change = (key: string, d: number) =>
    setLines((ls) =>
      ls.flatMap((l) => {
        if (l.key !== key) return [l];
        const qty = l.qty + d;
        if (d > 0 && stockOn && l.item.track_stock && qtyInCart(l.item.id) + d > l.item.stock_qty) return [l];
        return qty <= 0 ? [] : [{ ...l, qty }];
      }),
    );

  const reset = () => {
    setLines([]);
    setName("");
    setTableId("");
    setCartOpen(false);
  };

  const submit = async (payment: { method: PayMethod; amountReceived: number | null } | null) => {
    if (orderType === "dine_in" && !tableId && (tables.data?.tables.length ?? 0) > 0) {
      toast("Pilih meja dulu, atau ubah ke Bawa pulang.", "error");
      return;
    }
    setBusy(true);
    try {
      const r = await api.post<{ number: number; total: number }>("/api/store/orders", {
        orderType,
        tableId: orderType === "dine_in" && tableId ? tableId : null,
        customerName: name,
        items: lines.map((l) => ({ id: l.item.id, qty: l.qty, note: l.note })),
        payment,
      });
      toast(payment ? `Pesanan #${r.number} lunas dan dikirim ke dapur.` : `Pesanan #${r.number} dikirim ke dapur. Belum dibayar.`);
      setPaying(false);
      reset();
      items.reload(true);
      feed.reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (items.error) return <ErrorState message={items.error.message} onRetry={() => items.reload()} />;

  const cart = (
    <div className={`panel pos-cart${narrow && !cartOpen ? " collapsed" : ""}`} aria-label="Keranjang">
      <div className="stack">
        <div className="row between">
          <h2>Pesanan baru</h2>
          {lines.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={reset}>
              Kosongkan
            </button>
          )}
        </div>
        <Segmented
          label="Jenis pesanan"
          value={orderType}
          onChange={setOrderType}
          options={[
            { value: "dine_in", label: "Makan di sini" },
            { value: "takeaway", label: "Bawa pulang" },
          ]}
        />
        {orderType === "dine_in" && (tables.data?.tables.length ?? 0) > 0 && (
          <select className="select" value={tableId} onChange={(e) => setTableId(e.target.value)} aria-label="Meja">
            <option value="">Pilih meja</option>
            {tables.data!.tables.filter((t) => t.active).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.area ? ` (${t.area})` : ""}
                {t.open_orders ? ` · ${t.open_orders} pesanan berjalan` : ""}
              </option>
            ))}
          </select>
        )}
        <input className="input" placeholder="Nama pelanggan (boleh kosong)" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Nama pelanggan" />
        <hr className="divider-dashed" style={{ margin: "4px 0" }} />
        {lines.length === 0 ? (
          <p className="muted small" style={{ padding: "12px 0" }}>
            Ketuk menu di sebelah {narrow ? "atas" : "kiri"} untuk menambahkan.
          </p>
        ) : (
          <div className="cart-lines">
            {lines.map((l) => (
              <div className="cart-line" key={l.key}>
                <div style={{ minWidth: 0 }}>
                  <div className="strong" style={{ overflowWrap: "anywhere" }}>{l.item.name}</div>
                  <div className="small muted money">{rupiah(l.item.price * l.qty)}</div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: "0 4px", minHeight: 28, color: l.note ? "var(--warn-text)" : "var(--ink-2)" }}
                    onClick={() => {
                      setNoteFor(l);
                      setNoteText(l.note);
                    }}
                  >
                    {l.note ? `Catatan: ${l.note}` : "+ Catatan"}
                  </button>
                </div>
                <div className="qty">
                  <button onClick={() => change(l.key, -1)} aria-label={l.qty === 1 ? `Hapus ${l.item.name}` : `Kurangi ${l.item.name}`}>
                    {l.qty === 1 ? <Trash2 /> : <Minus />}
                  </button>
                  <span className="num" aria-live="polite">{l.qty}</span>
                  <button onClick={() => change(l.key, 1)} aria-label={`Tambah ${l.item.name}`}>
                    <Plus />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <hr className="divider-dashed" style={{ margin: "4px 0" }} />
        <div className="stack-sm">
          {(service > 0 || tax > 0) && (
            <div className="sum-row small muted">
              <span>Subtotal</span>
              <span className="money">{rupiah(subtotal)}</span>
            </div>
          )}
          {service > 0 && (
            <div className="sum-row small muted">
              <span>Service {tenant?.service_rate}%</span>
              <span className="money">{rupiah(service)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="sum-row small muted">
              <span>Pajak {tenant?.tax_rate}%</span>
              <span className="money">{rupiah(tax)}</span>
            </div>
          )}
          <div className="sum-row total">
            <span>Total</span>
            <span className="money">{rupiah(total)}</span>
          </div>
        </div>
        <button className="btn btn-primary btn-lg btn-block" disabled={!lines.length || busy || tenant?.locked} onClick={() => setPaying(true)}>
          Bayar sekarang
        </button>
        <button className="btn btn-block" disabled={!lines.length || busy || tenant?.locked} onClick={() => submit(null)}>
          Kirim ke dapur, bayar nanti
        </button>
      </div>
    </div>
  );

  return (
    <>
      <PageHead title="Kasir" sub="Catat pesanan pelanggan yang datang langsung ke kasir." />
      <div className="pos">
        <div className="stack" style={{ minWidth: 0 }}>
          <div className="cust-search">
            <Search aria-hidden="true" />
            <input className="input" placeholder="Cari menu" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari menu" />
          </div>
          <div className="chips" role="group" aria-label="Kategori">
            <button className="chip" aria-pressed={cat === "all"} onClick={() => setCat("all")}>
              Semua
            </button>
            {cats.data?.categories.map((c) => (
              <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
          {items.loading ? (
            <Loading rows={3} height={140} />
          ) : list.length === 0 ? (
            <div className="panel">
              <Empty title={items.data?.items.length ? "Menu tidak ditemukan" : "Belum ada menu"}>
                {items.data?.items.length ? "Coba kata lain atau pilih kategori Semua." : "Tambahkan menu dulu di halaman Menu & produk."}
              </Empty>
            </div>
          ) : (
            <div className="pos-grid">
              {list.map((i) => {
                const n = qtyInCart(i.id);
                const out = soldOut(i);
                const left = stockOn && i.track_stock ? i.stock_qty - n : null;
                return (
                  <button key={i.id} className="pos-item" onClick={() => add(i)} disabled={out} aria-label={`${i.name}, ${rupiah(i.price)}${out ? ", habis" : ""}`}>
                    <div className="thumb">
                      <Thumb image={i.image_url} name={i.name} />
                    </div>
                    <div className="info">
                      <span className="name">{i.name}</span>
                      <span className="money small">{rupiah(i.price)}</span>
                      {out ? <span className="badge badge-danger" style={{ justifySelf: "start" }}>Habis</span> : left != null && left <= i.low_stock_at ? <span className="tiny" style={{ color: "var(--warn-text)", fontWeight: 700 }}>Sisa {left}</span> : null}
                    </div>
                    {n > 0 && <span className="count in-cart">{n}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {cart}
      </div>

      {narrow && !cartOpen && lines.length > 0 && (
        <div className="pos-cartbar">
          <button className="btn btn-primary btn-lg btn-block" onClick={() => { setCartOpen(true); setTimeout(() => document.querySelector(".pos-cart")?.scrollIntoView({ behavior: "smooth" }), 30); }}>
            <ChevronUp /> {count} item · {rupiah(total)}
          </button>
        </div>
      )}

      <PaymentModal open={paying} total={total} busy={busy} onClose={() => setPaying(false)} onPay={(p) => submit(p)} />

      <Modal
        open={!!noteFor}
        onClose={() => setNoteFor(null)}
        title={noteFor ? `Catatan untuk ${noteFor.item.name}` : ""}
        footer={
          <>
            <button className="btn" onClick={() => setNoteFor(null)}>
              Batal
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setLines((ls) => ls.map((l) => (l.key === noteFor!.key ? { ...l, note: noteText.trim() } : l)));
                setNoteFor(null);
              }}
            >
              Simpan catatan
            </button>
          </>
        }
      >
        <input className="input" autoFocus value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Mis. tidak pedas, es sedikit" maxLength={120} aria-label="Catatan" />
      </Modal>
    </>
  );
}
