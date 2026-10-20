import { useState } from "react";
import { Link } from "react-router-dom";
import { Boxes } from "lucide-react";
import { Empty, ErrorState, Field, Loading, Modal, PageHead, Segmented, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { dateTime } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { isManagement, useSession } from "../../lib/session";
import { variantLabel } from "../../../../shared/variants";

function Cond({ qty, low }: { qty: number; low: number }) {
  return qty <= 0 ? <span className="badge badge-danger">Habis</span> : qty <= low ? <span className="badge badge-warn">Menipis</span> : <span className="badge badge-ok">Aman</span>;
}

interface StockItem {
  id: string;
  name: string;
  unit: string;
  stock_qty: number;
  low_stock_at: number;
  track_stock: number;
  available: number;
  category_name: string | null;
  variants?: { id: string; opt1: string; opt2: string; stock_qty: number; available: number }[];
  /** Diisi saat mencatat stok satu varian. */
  variantId?: string;
}
interface Movement {
  id: string;
  change: number;
  reason: string;
  note: string;
  created_at: number;
  item_name: string;
  unit: string;
  user_name: string | null;
  order_number: number | null;
}

const REASON: Record<string, string> = { restock: "Barang masuk", sale: "Terjual", cancel: "Pesanan batal", adjust: "Hitung ulang", waste: "Rusak / hilang" };

export function StockPage() {
  const { user } = useSession();
  const mgmt = isManagement(user?.role);
  const { data, error, loading, reload } = useApi<{ enabled: boolean; items: StockItem[]; movements: Movement[] }>("/api/store/stock");
  const [act, setAct] = useState<{ item: StockItem; mode: "restock" | "waste" | "set" } | null>(null);
  const [showUntracked, setShowUntracked] = useState(false);

  if (error) return <ErrorState message={error.message} onRetry={() => reload()} />;
  if (loading || !data) return <Loading rows={5} height={52} />;

  if (!data.enabled) {
    return (
      <>
        <PageHead title="Stok" />
        <div className="panel">
          <Empty icon={<Boxes aria-hidden="true" />} title="Pencatatan stok belum dinyalakan" action={mgmt && <Link className="btn btn-primary" to="/toko/pengaturan">Buka Pengaturan</Link>}>
            Stok itu pilihan. Kalau kamu cukup memakai menu dan pencatatan pesanan, bagian ini boleh diabaikan.
          </Empty>
        </div>
      </>
    );
  }

  const tracked = data.items.filter((i) => i.track_stock);
  const untracked = data.items.filter((i) => !i.track_stock);
  // Produk bervarian dianggap menipis kalau salah satu variannya menipis.
  const low = tracked.filter((i) => (i.variants?.length ? i.variants.some((v) => v.available && v.stock_qty <= i.low_stock_at) : i.stock_qty <= i.low_stock_at));

  return (
    <>
      <PageHead
        title="Stok"
        sub={low.length ? `${low.length} barang perlu diisi ulang.` : tracked.length ? "Semua stok aman." : "Belum ada barang yang dihitung stoknya."}
      />
      <div className="stack" style={{ gap: 20 }}>
        <div className="panel flush">
          {tracked.length === 0 ? (
            <Empty title="Belum ada barang yang dihitung">
              {mgmt ? "Pilih barang dari daftar di bawah lalu tekan Mulai hitung. Cocok untuk barang jadi seperti minuman botol, rokok, atau kerupuk." : "Minta manajemen menentukan barang mana yang dihitung stoknya."}
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Barang</th>
                    <th className="r">Stok</th>
                    <th>Kondisi</th>
                    {mgmt && <th className="r">Catat</th>}
                  </tr>
                </thead>
                <tbody>
                  {tracked.flatMap((i) => {
                    const acts = (t: StockItem) =>
                      mgmt && (
                        <td className="r">
                          <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                            <button className="btn btn-sm btn-primary" onClick={() => setAct({ item: t, mode: "restock" })} aria-label={`Barang masuk ${t.name}`}>Barang masuk</button>
                            <button className="btn btn-sm" onClick={() => setAct({ item: t, mode: "waste" })} aria-label={`Rusak ${t.name}`}>Rusak</button>
                            <button className="btn btn-sm btn-ghost" onClick={() => setAct({ item: t, mode: "set" })} aria-label={`Hitung ulang ${t.name}`}>Hitung ulang</button>
                          </div>
                        </td>
                      );
                    const head = (
                      <tr key={i.id} className={i.variants?.length ? "stock-parent" : undefined}>
                        <td>
                          <div className="strong">{i.name}</div>
                          <div className="tiny muted">{i.category_name ?? "Tanpa kategori"}{i.variants?.length ? ` · ${i.variants.length} varian` : ""}</div>
                        </td>
                        <td className="r num strong">
                          {i.stock_qty} <span className="muted small">{i.unit}</span>
                        </td>
                        <td>{i.variants?.length ? <span className="tiny muted">total semua varian</span> : <Cond qty={i.stock_qty} low={i.low_stock_at} />}</td>
                        {i.variants?.length ? mgmt && <td /> : acts(i)}
                      </tr>
                    );
                    return [
                      head,
                      ...(i.variants ?? []).map((v) => {
                        const t: StockItem = { ...i, name: `${i.name} (${variantLabel(v)})`, stock_qty: v.stock_qty, variantId: v.id, variants: undefined };
                        return (
                          <tr key={v.id} className="stock-variant">
                            <td><span className="variant-tag" style={{ marginLeft: 0 }}>{variantLabel(v)}</span>{!v.available && <span className="tiny muted"> · tidak dijual</span>}</td>
                            <td className="r num">{v.stock_qty}</td>
                            <td><Cond qty={v.stock_qty} low={i.low_stock_at} /></td>
                            {acts(t)}
                          </tr>
                        );
                      }),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {mgmt && untracked.length > 0 && (
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>Belum dihitung stoknya</h2>
                <p>Makanan yang dimasak sendiri biasanya tidak perlu dihitung. Cukup tandai Habis di halaman Menu.</p>
              </div>
              <button className="btn btn-sm" onClick={() => setShowUntracked((v) => !v)} aria-expanded={showUntracked}>
                {showUntracked ? "Sembunyikan" : `Tampilkan ${untracked.length}`}
              </button>
            </div>
            {showUntracked && (
              <div className="stack-sm">
                {untracked.map((i) => (
                  <div key={i.id} className="row between" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                    <span>{i.name}</span>
                    {i.variants?.length ? (
                      <Link className="btn btn-sm" to="/toko/menu">Isi stok per varian</Link>
                    ) : (
                      <button className="btn btn-sm" onClick={() => setAct({ item: i, mode: "set" })}>Mulai hitung</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="panel flush">
          <div style={{ padding: "16px 16px 8px" }}>
            <h2>Riwayat keluar-masuk</h2>
          </div>
          {data.movements.length === 0 ? (
            <Empty title="Belum ada catatan">Setiap barang masuk, terjual, atau rusak akan tercatat di sini.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Barang</th>
                    <th>Keterangan</th>
                    <th className="r">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {data.movements.map((m) => (
                    <tr key={m.id}>
                      <td className="nowrap small">{dateTime(m.created_at)}</td>
                      <td>{m.item_name}</td>
                      <td className="small">
                        {REASON[m.reason] ?? m.reason}
                        {m.order_number ? ` · pesanan #${m.order_number}` : ""}
                        {m.note ? ` · ${m.note}` : ""}
                        {m.user_name ? <span className="muted"> · {m.user_name}</span> : ""}
                      </td>
                      <td className="r num strong" style={{ color: m.change > 0 ? "var(--brand-text)" : undefined }}>
                        {m.change > 0 ? `+${m.change}` : m.change}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {act && <MoveModal act={act} onClose={() => setAct(null)} onDone={() => { setAct(null); reload(true); }} />}
    </>
  );
}

function MoveModal({ act, onClose, onDone }: { act: { item: StockItem; mode: "restock" | "waste" | "set" }; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState(act.mode);
  const [qty, setQty] = useState<number | "">(act.mode === "set" ? act.item.stock_qty : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const it = act.item;
  const after = qty === "" ? null : mode === "restock" ? it.stock_qty + qty : mode === "waste" ? it.stock_qty - qty : qty;

  return (
    <Modal
      open
      onClose={onClose}
      title={it.name}
      footer={
        <>
          <button className="btn" onClick={onClose}>Batal</button>
          <button
            className="btn btn-primary"
            disabled={busy || qty === "" || (after != null && after < 0)}
            onClick={async () => {
              setBusy(true);
              try {
                await api.post("/api/store/stock/movements", { itemId: it.id, variantId: it.variantId ?? null, mode, qty, note });
                toast(`Stok ${it.name} sekarang ${after} ${it.unit}.`);
                onDone();
              } catch (e) {
                toast((e as Error).message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Simpan
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Segmented
          label="Jenis catatan"
          value={mode}
          onChange={(m) => { setMode(m); setQty(m === "set" ? it.stock_qty : ""); }}
          options={[
            { value: "restock", label: "Barang masuk" },
            { value: "waste", label: "Rusak / hilang" },
            { value: "set", label: "Hitung ulang" },
          ]}
        />
        <Field
          label={mode === "set" ? `Jumlah sebenarnya di rak (${it.unit})` : `Jumlah (${it.unit})`}
          htmlFor="mv-qty"
          hint={`Stok tercatat sekarang: ${it.stock_qty} ${it.unit}${after != null ? `. Setelah disimpan: ${after} ${it.unit}.` : ""}`}
          error={after != null && after < 0 ? "Jumlahnya lebih besar dari stok yang ada." : null}
        >
          <input id="mv-qty" className="input num" inputMode="numeric" autoFocus value={qty} onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); setQty(d === "" ? "" : Number(d)); }} />
        </Field>
        <Field label="Catatan (opsional)" htmlFor="mv-note">
          <input id="mv-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder={mode === "restock" ? "Mis. dari agen, nota no. 123" : mode === "waste" ? "Mis. botol pecah" : "Mis. stock opname akhir bulan"} />
        </Field>
      </div>
    </Modal>
  );
}
