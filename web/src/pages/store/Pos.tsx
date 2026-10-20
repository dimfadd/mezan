import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, Search, Trash2, ChevronUp, WifiOff, Clock3, Wallet, Sparkles, ScanLine } from "lucide-react";
import { Empty, ErrorState, Loading, Modal, PageHead, Segmented, Thumb, useToast } from "../../components/ui";
import { PaymentModal, type PayMethod } from "../../components/PaymentModal";
import { ReceiptShare } from "../../components/ReceiptShare";
import { printReceipt } from "../../components/receipt";
import { api, ApiError } from "../../lib/api";
import { rupiah } from "../../lib/format";
import { useApi, useMediaQuery } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import { useOrderFeed } from "../../components/Shell";
import { newClientId, useOutbox } from "../../lib/outbox";
import { priceNow, useStoreClock } from "../../lib/pricing";
import { scheduleText } from "../../../../shared/schedule";
import { lineName, priceRange, variantLabel } from "../../../../shared/variants";
import { CameraScanner, useScannerInput } from "../../lib/barcode";
import { VariantPicker } from "../../components/VariantPicker";
import { Onboarding } from "../../components/Onboarding";
import { isRetail } from "../../lib/session";
import type { Category, DiningTable, ItemVariant, LoyaltyCard, MenuItem, Order, Pricing } from "./types";

interface Line {
  key: string;
  item: MenuItem;
  variant: ItemVariant | null;
  qty: number;
  note: string;
}

type Done = { number: number; total: number; token: string; paid: boolean; phone?: string; card?: LoyaltyCard | null; id: string };

export function PosPage() {
  const { tenant } = useSession();
  const toast = useToast();
  const feed = useOrderFeed();
  const outbox = useOutbox();
  // Disimpan di HP supaya kasir tetap bisa dipakai saat internet putus.
  const items = useApi<{ items: MenuItem[]; pricing?: Pricing }>("/api/store/items", { cache: true });
  const cats = useApi<{ categories: Category[] }>("/api/store/categories", { cache: true });
  const tables = useApi<{ tables: DiningTable[] }>("/api/store/tables", { cache: true });
  const clock = useStoreClock(items.data?.pricing);
  const rules = items.data?.pricing?.rules ?? [];
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
  const [done, setDone] = useState<Done | null>(null);
  const [picking, setPicking] = useState<MenuItem | null>(null);
  const [picked, setPicked] = useState<ItemVariant | null>(null);
  const [scanning, setScanning] = useState(false);
  const retail = isRetail(tenant);
  const type = retail ? "takeaway" : orderType;

  const stockOn = !!tenant?.inventory_enabled;
  const all = items.data?.items ?? [];
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return all.filter(
      (i) =>
        (cat === "all" || i.category_id === cat) &&
        (!s || i.name.toLowerCase().includes(s) || i.sku?.toLowerCase() === s || i.barcode === s || (i.variants ?? []).some((v) => v.barcode === s || v.sku.toLowerCase() === s)),
    );
  }, [all, cat, q]);
  // Barcode → produk (+ varian). Dibaca dari daftar yang tersimpan di HP, jadi scan tetap jalan saat offline.
  const byCode = useMemo(() => {
    const m = new Map<string, { item: MenuItem; variant: ItemVariant | null }>();
    for (const i of all) {
      if (i.barcode) m.set(i.barcode, { item: i, variant: null });
      for (const v of i.variants ?? []) if (v.barcode) m.set(v.barcode, { item: i, variant: v });
    }
    return m;
  }, [all]);
  const price = (i: MenuItem, v?: ItemVariant | null) => priceNow({ ...i, price: v && v.price != null ? v.price : i.price }, rules, clock);

  const subtotal = lines.reduce((s, l) => s + price(l.item, l.variant).price * l.qty, 0);
  const service = Math.round((subtotal * (tenant?.service_rate ?? 0)) / 100);
  const tax = Math.round(((subtotal + service) * (tenant?.tax_rate ?? 0)) / 100);
  const total = subtotal + service + tax;
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const qtyInCart = (id: string, vid?: string | null) => lines.filter((l) => l.item.id === id && (vid === undefined || (l.variant?.id ?? null) === vid)).reduce((s, l) => s + l.qty, 0);
  const vSoldOut = (i: MenuItem, v: ItemVariant) => !v.available || (stockOn && !!i.track_stock && v.stock_qty - qtyInCart(i.id, v.id) <= 0);
  const hasVariants = (i: MenuItem) => (i.variants?.length ?? 0) > 0;
  const soldOut = (i: MenuItem) =>
    !i.available || (hasVariants(i) ? i.variants!.every((v) => vSoldOut(i, v)) : stockOn && !!i.track_stock && i.stock_qty - qtyInCart(i.id) <= 0);
  const blocked = (i: MenuItem) => soldOut(i) || !price(i).open;

  // Saran untuk ditawarkan kasir: pasangan dari menu yang sudah di keranjang, yang belum dipesan.
  const suggestions = useMemo(() => {
    const inCart = new Set(lines.map((l) => l.item.id));
    const byId = new Map(all.map((i) => [i.id, i]));
    const out: MenuItem[] = [];
    for (const l of lines) for (const id of l.item.pairs ?? []) {
      const it = byId.get(id);
      if (it && !inCart.has(id) && !out.includes(it) && !blocked(it)) out.push(it);
    }
    return out.slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, all, clock]);

  const add = (item: MenuItem, variant: ItemVariant | null = null) => {
    if (blocked(item)) return false;
    if (hasVariants(item) && !variant) {
      setPicked(null);
      setPicking(item);
      return true;
    }
    if (variant && vSoldOut(item, variant)) return false;
    setLines((ls) => {
      const ex = ls.find((l) => l.item.id === item.id && (l.variant?.id ?? null) === (variant?.id ?? null) && l.note === "");
      if (ex) return ls.map((l) => (l === ex ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { key: `${item.id}-${variant?.id ?? ""}-${Date.now()}`, item, variant, qty: 1, note: "" }];
    });
    return true;
  };
  const change = (key: string, d: number) =>
    setLines((ls) =>
      ls.flatMap((l) => {
        if (l.key !== key) return [l];
        const qty = l.qty + d;
        const have = l.variant ? l.variant.stock_qty : l.item.stock_qty;
        if (d > 0 && stockOn && l.item.track_stock && qtyInCart(l.item.id, l.variant ? l.variant.id : undefined) + d > have) return [l];
        return qty <= 0 ? [] : [{ ...l, qty }];
      }),
    );
  const label = (l: Line) => lineName(l.item.name, l.variant ? variantLabel(l.variant) : null);

  // Hasil scan (alat scan, kamera, atau ketik kode lalu Enter).
  const onScan = (code: string) => {
    const hit = byCode.get(code);
    if (!hit) {
      toast(`Barcode ${code} belum terdaftar. Tambahkan di halaman produk.`, "error");
      return false;
    }
    const name = lineName(hit.item.name, hit.variant ? variantLabel(hit.variant) : null);
    if (!add(hit.item, hit.variant)) {
      toast(`${name} habis.`, "error");
      return false;
    }
    if (!hasVariants(hit.item) || hit.variant) toast(`Ditambahkan: ${name}`);
    return true;
  };
  useScannerInput(onScan, !paying && !scanning && !picking && !noteFor);

  const reset = () => {
    setLines([]);
    setName("");
    setTableId("");
    setCartOpen(false);
  };

  const submit = async (payment: { method: PayMethod; amountReceived: number | null; phone?: string } | null) => {
    if (type === "dine_in" && !tableId && (tables.data?.tables.length ?? 0) > 0) {
      toast("Pilih meja dulu, atau ubah ke Bawa pulang.", "error");
      return;
    }
    setBusy(true);
    const clientId = newClientId();
    const body = {
      orderType: type,
      tableId: type === "dine_in" && tableId ? tableId : null,
      customerName: name,
      items: lines.map((l) => ({ id: l.item.id, variantId: l.variant?.id ?? null, qty: l.qty, note: l.note })),
      payment: payment ? { method: payment.method, amountReceived: payment.amountReceived } : null,
      ...(payment?.phone ? { phone: payment.phone } : {}),
    };
    const saveOffline = () => {
      const e = outbox.add({
        clientId,
        at: Date.now(),
        total,
        summary: lines.map((l) => `${l.qty}× ${label(l)}`).join(", ").slice(0, 120),
        body,
      });
      toast(`Internet putus. Pesanan disimpan sebagai Offline ${e.label} dan dikirim otomatis saat sinyal kembali.`);
      setPaying(false);
      reset();
    };
    try {
      if (!navigator.onLine) return saveOffline();
      const r = await api.post<{ id: string; number: number; total: number; token: string; loyalty?: { card: LoyaltyCard; stamped: boolean } | null }>("/api/store/orders", { ...body, clientId });
      setPaying(false);
      setDone({ id: r.id, number: r.number, total: r.total, token: r.token, paid: !!payment, phone: payment?.phone, card: r.loyalty?.card ?? null });
      if (r.loyalty?.stamped) toast(`Stempel ditambahkan: ${r.loyalty.card.stamps}/${r.loyalty.card.target}.`);
      reset();
      items.reload(true);
      feed.reload();
    } catch (e) {
      // Tidak ada jawaban dari server: simpan di HP. ID yang sama dipakai saat kirim ulang, jadi tidak dobel.
      if (e instanceof ApiError && e.status === 0) {
        saveOffline();
      } else {
        toast((e as Error).message, "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const printDone = async () => {
    if (!done || !tenant) return;
    try {
      const r = await api.get<{ orders: Order[] }>(`/api/store/orders?scope=history&q=${done.number}`);
      const o = r.orders.find((x) => x.id === done.id);
      if (o && !printReceipt(o, tenant)) toast("Izinkan pop-up di browser untuk mencetak struk.", "error");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (items.error && !items.data) return <ErrorState message={items.error.message} onRetry={() => items.reload()} />;

  const cart = (
    <div className={`panel pos-cart${narrow && !cartOpen ? " collapsed" : ""}`} aria-label="Keranjang">
      <div className="stack">
        <div className="row between">
          <h2>{retail ? "Penjualan baru" : "Pesanan baru"}</h2>
          {lines.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={reset}>
              Kosongkan
            </button>
          )}
        </div>
        {!retail && (
          <Segmented
            label="Jenis pesanan"
            value={orderType}
            onChange={setOrderType}
            options={[
              { value: "dine_in", label: "Makan di sini" },
              { value: "takeaway", label: "Bawa pulang" },
            ]}
          />
        )}
        {type === "dine_in" && (tables.data?.tables.length ?? 0) > 0 && (
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
            {retail ? `Scan barcode atau ketuk produk di sebelah ${narrow ? "atas" : "kiri"}.` : `Ketuk menu di sebelah ${narrow ? "atas" : "kiri"} untuk menambahkan.`}
          </p>
        ) : (
          <div className="cart-lines">
            {lines.map((l) => {
              const p = price(l.item, l.variant);
              return (
                <div className="cart-line" key={l.key}>
                  <div style={{ minWidth: 0 }}>
                    <div className="strong" style={{ overflowWrap: "anywhere" }}>
                      {l.item.name}
                      {l.variant && <span className="variant-tag">{variantLabel(l.variant)}</span>}
                    </div>
                    <div className="small muted money">
                      {p.promo && <s className="was">{rupiah(p.list * l.qty)}</s>} {rupiah(p.price * l.qty)}
                      {p.promo && <span className="promo-tag">{p.promo}</span>}
                    </div>
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
                    <button onClick={() => change(l.key, -1)} aria-label={l.qty === 1 ? `Hapus ${label(l)}` : `Kurangi ${label(l)}`}>
                      {l.qty === 1 ? <Trash2 /> : <Minus />}
                    </button>
                    <span className="num" aria-live="polite">{l.qty}</span>
                    <button onClick={() => change(l.key, 1)} aria-label={`Tambah ${label(l)}`}>
                      <Plus />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {suggestions.length > 0 && (
          <div className="pair-box">
            <span className="small strong"><Sparkles aria-hidden="true" /> Tawarkan juga</span>
            <div className="row wrap" style={{ gap: 6 }}>
              {suggestions.map((s) => (
                <button key={s.id} type="button" className="chip" onClick={() => add(s)}>
                  <Plus aria-hidden="true" /> {s.name} · <span className="money">{rupiah(price(s).price)}</span>
                </button>
              ))}
            </div>
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
          {retail ? "Simpan, bayar nanti" : "Kirim ke dapur, bayar nanti"}
        </button>
        {!outbox.online && <p className="tiny muted"><WifiOff aria-hidden="true" className="inline-ico" /> Offline: pesanan disimpan di perangkat ini dan dikirim saat sinyal kembali.</p>}
      </div>
    </div>
  );

  return (
    <>
      <PageHead
        title="Kasir"
        sub={
          items.stale
            ? "Offline: memakai daftar produk yang tersimpan di perangkat ini. Scan barcode tetap jalan."
            : retail
              ? "Scan barcode dengan alat scan atau kamera, atau ketuk produknya."
              : "Catat pesanan pelanggan yang datang langsung ke kasir."
        }
      />
      {retail && <Onboarding />}
      {feed.shiftOpen === false && (
        <div className="banner info" role="note">
          <Wallet aria-hidden="true" />
          <div className="row between wrap" style={{ flex: 1, gap: 8 }}>
            <span>Shift kasir belum dibuka. Buka shift supaya uang di laci bisa dicocokkan saat tutup.</span>
            <Link className="btn btn-sm" to="/toko/kas">Buka shift</Link>
          </div>
        </div>
      )}
      <div className="pos">
        <div className="stack" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <div className="cust-search" style={{ flex: 1 }}>
              <Search aria-hidden="true" />
              <input
                className="input"
                placeholder={retail ? "Cari produk, SKU, atau ketik barcode" : "Cari menu"}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  // Alat scan yang mengetik ke kolom ini, atau kode diketik manual lalu Enter.
                  if (e.key !== "Enter") return;
                  const code = q.trim();
                  if (byCode.has(code)) {
                    e.preventDefault();
                    if (onScan(code)) setQ("");
                  } else if (list.length === 1) {
                    e.preventDefault();
                    if (add(list[0])) setQ("");
                  }
                }}
                aria-label={retail ? "Cari produk atau barcode" : "Cari menu"}
              />
            </div>
            <button type="button" className="btn" onClick={() => setScanning(true)} aria-label="Scan barcode dengan kamera" title="Scan barcode dengan kamera">
              <ScanLine /> <span className="hide-sm">Scan</span>
            </button>
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
              <Empty title={all.length ? "Menu tidak ditemukan" : "Belum ada menu"}>
                {all.length ? "Coba kata lain atau pilih kategori Semua." : "Tambahkan menu dulu di halaman Menu & produk."}
              </Empty>
            </div>
          ) : (
            <div className="pos-grid">
              {list.map((i) => {
                const n = qtyInCart(i.id);
                const out = soldOut(i);
                const p = price(i);
                const left = stockOn && i.track_stock ? i.stock_qty - n : null;
                const range = hasVariants(i) ? priceRange(i.price, i.variants!) : null;
                const from = range && range.min !== range.max;
                return (
                  <button
                    key={i.id}
                    className="pos-item"
                    onClick={() => add(i)}
                    disabled={out || !p.open}
                    aria-label={`${i.name}, ${rupiah(p.price)}${p.promo ? `, ${p.promo}` : ""}${out ? ", habis" : !p.open ? ", di luar jam" : ""}`}
                  >
                    <div className="thumb">
                      <Thumb image={i.image_url} name={i.name} />
                    </div>
                    <div className="info">
                      <span className="name">{i.name}</span>
                      <span className="money small">
                        {from ? <>mulai {rupiah(price(i, { price: range!.min } as ItemVariant).price)}</> : <>{p.promo && <s className="was">{rupiah(p.list)}</s>} {rupiah(range ? price(i, { price: range.min } as ItemVariant).price : p.price)}</>}
                      </span>
                      {hasVariants(i) && <span className="tiny muted">{i.variants!.length} varian</span>}
                      {out ? (
                        <span className="badge badge-danger" style={{ justifySelf: "start" }}>Habis</span>
                      ) : !p.open ? (
                        <span className="badge" style={{ justifySelf: "start" }}><Clock3 aria-hidden="true" /> {scheduleText(i)}</span>
                      ) : p.promo ? (
                        <span className="promo-tag" style={{ justifySelf: "start" }}>{p.promo} −{p.percent}%</span>
                      ) : left != null && left <= i.low_stock_at ? (
                        <span className="tiny" style={{ color: "var(--warn-text)", fontWeight: 700 }}>Sisa {left}</span>
                      ) : null}
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
      <CameraScanner open={scanning} continuous onClose={() => setScanning(false)} onScan={onScan} title="Scan barang" />
      <Modal
        open={!!picking}
        onClose={() => setPicking(null)}
        title={picking ? `Pilih varian ${picking.name}` : ""}
        footer={
          <>
            <button className="btn" onClick={() => setPicking(null)}>Batal</button>
            <button
              className="btn btn-primary"
              disabled={!picked}
              onClick={() => {
                if (picking && picked) add(picking, picked);
                setPicking(null);
              }}
            >
              Tambah ke keranjang
            </button>
          </>
        }
      >
        {picking && (
          <VariantPicker
            opt1Name={picking.opt1_name || "Pilihan"}
            opt2Name={picking.opt2_name || ""}
            variants={(picking.variants ?? []).map((v) => ({ ...v, sold_out: vSoldOut(picking, v) }))}
            value={picked ? { ...picked, sold_out: false } : null}
            onChange={(v) => setPicked(v)}
            priceOf={(v) => {
              const left = stockOn && picking.track_stock ? v.stock_qty - qtyInCart(picking.id, v.id) : null;
              return `${rupiah(price(picking, v).price)}${left != null ? ` · sisa ${left}` : ""}`;
            }}
          />
        )}
      </Modal>
      <ReceiptShare open={!!done} order={done} phone={done?.phone} card={done?.card} onPrint={printDone} onClose={() => setDone(null)} />

      <Modal
        open={!!noteFor}
        onClose={() => setNoteFor(null)}
        title={noteFor ? `Catatan untuk ${label(noteFor)}` : ""}
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
