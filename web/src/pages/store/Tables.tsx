import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ExternalLink, Pencil, Plus, Printer, QrCode } from "lucide-react";
import { Empty, ErrorState, Field, Loading, Modal, PageHead, Segmented, Switch, useConfirm, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useSession } from "../../lib/session";
import type { DiningTable } from "./types";

export const tableUrl = (code: string) => `${window.location.origin}/m/${code}`;

function QrImage({ code, label }: { code: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(tableUrl(code), { margin: 1, width: 300, errorCorrectionLevel: "M" }).then(setSrc).catch(() => setSrc(null));
  }, [code]);
  return src ? <img src={src} alt={`Kode QR ${label}`} /> : <div className="skeleton" style={{ width: 150, height: 150 }} />;
}

export function TablesPage() {
  const { tenant } = useSession();
  const { data, error, loading, reload } = useApi<{ tables: DiningTable[] }>("/api/store/tables");
  const toast = useToast();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<DiningTable | null>(null);
  const tables = data?.tables ?? [];

  return (
    <>
      <PageHead
        title="Meja & QR"
        sub={`Tempel QR di tiap meja. Pelanggan pindai, lihat menu, lalu pesan langsung ke kasir. ${tables.length}/${tenant?.max_tables ?? 0} meja di paket ${tenant?.plan_name ?? ""}.`}
        actions={
          <>
            {tables.length > 0 && (
              <button className="btn" onClick={() => window.print()}>
                <Printer /> Cetak semua QR
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              <Plus /> Tambah meja
            </button>
          </>
        }
      />
      {!tenant?.qr_ordering_enabled && (
        <div className="banner info">
          <QrCode aria-hidden="true" />
          <div>Pesan lewat QR sedang dimatikan. Pelanggan tetap bisa melihat menu, tapi tidak bisa mengirim pesanan. Nyalakan di Pengaturan.</div>
        </div>
      )}
      {error ? (
        <ErrorState message={error.message} onRetry={() => reload()} />
      ) : loading ? (
        <Loading rows={2} height={200} />
      ) : tables.length === 0 ? (
        <div className="panel">
          <Empty icon={<QrCode aria-hidden="true" />} title="Belum ada meja" action={<button className="btn btn-primary" onClick={() => setAdding(true)}><Plus /> Tambah meja</button>}>
            Buat sekaligus, misalnya Meja 1 sampai Meja 10. Setiap meja dapat QR sendiri, jadi kasir tahu pesanan datang dari meja mana.
          </Empty>
        </div>
      ) : (
        <div className="qr-grid">
          {tables.map((t) => (
            <div className="qr-card" key={t.id} style={!t.active ? { opacity: 0.6 } : undefined}>
              <div className="tiny muted">{tenant?.name}</div>
              <QrImage code={t.code} label={t.label} />
              <div className="label">{t.label}</div>
              <div className="small muted">{t.area || "Pindai untuk lihat menu & pesan"}</div>
              {!t.active && <span className="badge badge-warn">Nonaktif</span>}
              {t.open_orders > 0 && <span className="badge badge-info">{t.open_orders} pesanan berjalan</span>}
              <div className="acts no-print">
                <a className="btn btn-sm" href={`/m/${t.code}`} target="_blank" rel="noreferrer">
                  <ExternalLink /> Buka
                </a>
                <button className="btn btn-sm" onClick={() => setEditing(t)} aria-label={`Ubah ${t.label}`}>
                  <Pencil /> Ubah
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddTables open={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(true); }} next={tables.length + 1} />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Ubah ${editing.label}` : ""}
      >
        {editing && (
          <EditTable
            table={editing}
            onSaved={() => { setEditing(null); reload(true); }}
            onRegenerate={async () => {
              if (await confirm({ title: "Ganti kode QR meja ini?", body: "QR lama yang sudah ditempel tidak akan berfungsi lagi. Kamu perlu mencetak dan menempel QR yang baru. Pakai ini kalau QR lama disalahgunakan.", confirm: "Ganti kode QR", danger: true })) {
                try {
                  await api.post(`/api/store/tables/${editing.id}/regenerate`);
                  toast("Kode QR diganti. Cetak ulang QR meja ini.");
                  setEditing(null);
                  reload(true);
                } catch (e) {
                  toast((e as Error).message, "error");
                }
              }
            }}
            onDelete={async () => {
              if (await confirm({ title: `Hapus ${editing.label}?`, body: "QR meja ini tidak bisa dipakai lagi. Riwayat pesanannya tetap ada di laporan.", confirm: "Hapus meja", danger: true })) {
                try {
                  await api.del(`/api/store/tables/${editing.id}`);
                  toast(`${editing.label} dihapus.`);
                  setEditing(null);
                  reload(true);
                } catch (e) {
                  toast((e as Error).message, "error");
                }
              }
            }}
          />
        )}
      </Modal>
    </>
  );
}

function AddTables({ open, onClose, onDone, next }: { open: boolean; onClose: () => void; onDone: () => void; next: number }) {
  const toast = useToast();
  const [mode, setMode] = useState<"bulk" | "one">("bulk");
  const [prefix, setPrefix] = useState("Meja");
  const [from, setFrom] = useState(next);
  const [to, setTo] = useState(next + 9);
  const [label, setLabel] = useState("");
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setFrom(next);
      setTo(next + 9);
    }
  }, [open, next]);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ created: number }>("/api/store/tables", mode === "bulk" ? { prefix, from, to, area } : { label, area });
      toast(`${r.created} meja ditambahkan.`);
      onDone();
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
      title="Tambah meja"
      footer={
        <>
          <button className="btn" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={busy || (mode === "one" && !label.trim())} onClick={submit}>
            {mode === "bulk" ? `Buat ${Math.max(0, to - from + 1)} meja` : "Tambah meja"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Segmented label="Cara tambah" value={mode} onChange={setMode} options={[{ value: "bulk", label: "Sekaligus" }, { value: "one", label: "Satu meja" }]} />
        {mode === "bulk" ? (
          <>
            <div className="form-row">
              <Field label="Nama depan" htmlFor="tb-prefix">
                <input id="tb-prefix" className="input" value={prefix} onChange={(e) => setPrefix(e.target.value)} maxLength={20} />
              </Field>
              <Field label="Dari nomor" htmlFor="tb-from">
                <input id="tb-from" className="input num" inputMode="numeric" value={from} onChange={(e) => setFrom(Number(e.target.value.replace(/\D/g, "") || 0))} />
              </Field>
              <Field label="Sampai nomor" htmlFor="tb-to">
                <input id="tb-to" className="input num" inputMode="numeric" value={to} onChange={(e) => setTo(Number(e.target.value.replace(/\D/g, "") || 0))} />
              </Field>
            </div>
            <p className="small muted">Hasilnya: {prefix} {from}, {prefix} {from + 1}, ... {prefix} {to}</p>
          </>
        ) : (
          <Field label="Nama meja" htmlFor="tb-label" hint="Bebas, mis. Lesehan A, Bar 2, VIP.">
            <input id="tb-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={30} />
          </Field>
        )}
        <Field label="Area (opsional)" htmlFor="tb-area" hint="Mis. Dalam, Teras, Lantai 2. Membantu pelayan mencari meja.">
          <input id="tb-area" className="input" value={area} onChange={(e) => setArea(e.target.value)} maxLength={30} />
        </Field>
      </div>
    </Modal>
  );
}

function EditTable({ table, onSaved, onRegenerate, onDelete }: { table: DiningTable; onSaved: () => void; onRegenerate: () => void; onDelete: () => void }) {
  const toast = useToast();
  const [label, setLabel] = useState(table.label);
  const [area, setArea] = useState(table.area);
  const [active, setActive] = useState(!!table.active);
  return (
    <form
      className="form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api.put(`/api/store/tables/${table.id}`, { label, area, active });
          toast("Meja disimpan.");
          onSaved();
        } catch (err) {
          toast((err as Error).message, "error");
        }
      }}
    >
      <Field label="Nama meja" htmlFor="et-label">
        <input id="et-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={30} required />
      </Field>
      <Field label="Area" htmlFor="et-area">
        <input id="et-area" className="input" value={area} onChange={(e) => setArea(e.target.value)} maxLength={30} />
      </Field>
      <Switch checked={active} onChange={setActive} label="Meja aktif" hint="Meja nonaktif tidak bisa dipakai memesan lewat QR." />
      <div className="row wrap between">
        <div className="row wrap">
          <button type="button" className="btn btn-sm" onClick={onRegenerate}>Ganti kode QR</button>
          <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}>Hapus meja</button>
        </div>
        <button type="submit" className="btn btn-primary">Simpan</button>
      </div>
    </form>
  );
}
