import { useState } from "react";
import { Link } from "react-router-dom";
import { Boxes } from "lucide-react";
import { Empty, ErrorState, Field, Loading, Modal, PageHead, Segmented, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { dateTime } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { isManagement, useSession } from "../../lib/session";

interface StockItem {
  id: string;
  name: string;
  unit: string;
  stock_qty: number;
  low_stock_at: number;
  track_stock: number;
  available: number;
  category_name: string | null;
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
  const low = tracked.filter((i) => i.stock_qty <= i.low_stock_at);

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
                  {tracked.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <div className="strong">{i.name}</div>
                        <div className="tiny muted">{i.category_name ?? "Tanpa kategori"}</div>
                      </td>
                      <td className="r num strong">
                        {i.stock_qty} <span className="muted small">{i.unit}</span>
                      </td>
                      <td>
                        {i.stock_qty <= 0 ? (
                          <span className="badge badge-danger">Habis</span>
                        ) : i.stock_qty <= i.low_stock_at ? (
                          <span className="badge badge-warn">Menipis</span>
                        ) : (
                          <span className="badge badge-ok">Aman</span>
                        )}
                      </td>
                      {mgmt && (
                        <td className="r">
                          <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                            <button className="btn btn-sm btn-primary" onClick={() => setAct({ item: i, mode: "restock" })}>Barang masuk</button>
                            <button className="btn btn-sm" onClick={() => setAct({ item: i, mode: "waste" })}>Rusak</button>
                            <button className="btn btn-sm btn-ghost" onClick={() => setAct({ item: i, mode: "set" })}>Hitung ulang</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
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
                    <button className="btn btn-sm" onClick={() => setAct({ item: i, mode: "set" })}>Mulai hitung</button>
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
                await api.post("/api/store/stock/movements", { itemId: it.id, mode, qty, note });
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
