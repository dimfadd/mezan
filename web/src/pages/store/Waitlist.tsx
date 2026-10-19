import { useEffect, useState } from "react";
import { ExternalLink, Hourglass, MessageCircle, Plus, Printer, RefreshCw, Users } from "lucide-react";
import { Empty, ErrorState, Field, Loading, Modal, PageHead, Switch, useConfirm, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { time } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { brandedQr } from "../../lib/qr";
import { isManagement, useSession } from "../../lib/session";
import { useOrderFeed } from "../../components/Shell";
import { waLink } from "../../components/ReceiptShare";
import type { DiningTable } from "./types";

interface Entry {
  id: string;
  number: number;
  name: string;
  party_size: number;
  phone?: string;
  note?: string;
  source?: string;
  status: "waiting" | "called" | "seated" | "cancelled" | "noshow";
  created_at: number;
  called_at?: number | null;
  done_at?: number | null;
  table_label: string | null;
}

export const waitUrl = (code: string) => `${window.location.origin}/antre/${code}`;
const DONE_LABEL: Record<string, string> = { seated: "Sudah duduk", cancelled: "Batal", noshow: "Tidak datang" };

function QrImg({ url, label }: { url: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    brandedQr(url).then(setSrc).catch(() => setSrc(null));
  }, [url]);
  return src ? <img src={src} alt={`Kode QR ${label}`} /> : <div className="skeleton" style={{ width: 150, height: 150 }} />;
}

export function WaitlistPage() {
  const { tenant, user, refresh } = useSession();
  const { data, error, loading, reload } = useApi<{ settings: { enabled: boolean; code: string | null }; open: Entry[]; done: Entry[] }>("/api/store/waitlist", { poll: 7000 });
  const tables = useApi<{ tables: DiningTable[] }>("/api/store/tables");
  const feed = useOrderFeed();
  const toast = useToast();
  const confirm = useConfirm();
  const mgmt = isManagement(user?.role);
  const [adding, setAdding] = useState(false);
  const [seating, setSeating] = useState<Entry | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);
  // Antrean baru dari QR ikut terdeteksi di polling papan pesanan; muat ulang daftar di sini juga.
  useEffect(() => {
    reload(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.waiting.length]);

  const set = async (e: Entry, status: Entry["status"], extra: object = {}) => {
    try {
      await api.patch(`/api/store/waitlist/${e.id}`, { status, ...extra });
      await reload(true);
      feed.reload();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };
  const call = (e: Entry) => {
    set(e, "called");
    if (e.phone && tenant) {
      const msg = `Halo ${e.name}, meja untuk ${e.party_size} orang di ${tenant.name} sudah siap. Silakan ke kasir dan sebut nomor antrean A${e.number}.`;
      window.open(waLink(e.phone, msg), "_blank", "noopener");
    }
  };
  const toggle = async (enabled: boolean) => {
    try {
      await api.put("/api/store/waitlist-settings", { enabled });
      await refresh();
      reload(true);
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };
  const regenerate = async () => {
    if (!(await confirm({ title: "Ganti kode QR antrean?", body: "QR lama yang sudah dicetak tidak berlaku lagi. Cetak dan tempel QR yang baru.", confirm: "Ganti kode" }))) return;
    try {
      await api.post("/api/store/waitlist-settings/regenerate");
      await refresh();
      reload(true);
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  const settings = data?.settings;
  const open = data?.open ?? [];
  return (
    <>
      <PageHead
        title="Antrean tunggu"
        sub="Saat semua meja penuh: tamu memindai QR di pintu, mengisi nama dan jumlah orang, lalu menunggu tanpa berdiri di depan kasir. HP-nya berbunyi saat dipanggil."
        actions={
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus /> Tambah tamu
          </button>
        }
      />
      {!settings?.enabled && !mgmt && <p className="banner info no-print">Antrean QR sedang dimatikan pemilik. Tamu masih bisa ditambahkan manual.</p>}

      {error && !data ? (
        <ErrorState message={error.message} onRetry={() => reload()} />
      ) : loading || !data ? (
        <Loading rows={3} height={70} />
      ) : (
        <div className="stack no-print" style={{ gap: 20 }}>
          <section aria-labelledby="wl-open">
            <h2 id="wl-open" style={{ marginBottom: 10 }}>Menunggu ({open.length})</h2>
            {open.length === 0 ? (
              <div className="panel"><Empty icon={<Hourglass aria-hidden="true" />} title="Tidak ada yang mengantre">Tamu yang mendaftar lewat QR pintu muncul di sini.</Empty></div>
            ) : (
              <div className="wl-list">
                {open.map((e) => {
                  const mins = Math.floor((now - e.created_at) / 60000);
                  return (
                    <article key={e.id} className={`wl-row${e.status === "called" ? " called" : ""}`}>
                      <div className="wl-no num">A{e.number}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="strong">{e.name} <span className="muted small"><Users aria-hidden="true" className="inline-ico" /> {e.party_size} orang</span></div>
                        <div className="small muted">
                          {e.status === "called" ? `Dipanggil ${time(e.called_at ?? e.created_at)}` : `Menunggu ${mins < 1 ? "baru saja" : `${mins} menit`}`}
                          {e.source === "kasir" ? " · dicatat kasir" : " · lewat QR"}
                          {e.phone ? " · ada WA" : ""}
                          {e.note ? ` · ${e.note}` : ""}
                        </div>
                      </div>
                      <div className="wl-acts">
                        {e.status === "waiting" ? (
                          <button className="btn btn-primary btn-sm" onClick={() => call(e)}>{e.phone ? <MessageCircle /> : null} Panggil</button>
                        ) : (
                          <>
                            {e.phone && (
                              <a className="btn btn-sm btn-ghost" href={waLink(e.phone, `Halo ${e.name}, meja kamu di ${tenant?.name ?? ""} sudah siap. Nomor antrean A${e.number}.`)} target="_blank" rel="noopener noreferrer" aria-label={`Kirim ulang WhatsApp ke ${e.name}`}>
                                <MessageCircle />
                              </a>
                            )}
                            <button className="btn btn-sm btn-ghost" onClick={() => set(e, "noshow")}>Tidak datang</button>
                          </>
                        )}
                        <button className="btn btn-sm" onClick={() => setSeating(e)}>Duduk</button>
                        {e.status === "waiting" && <button className="btn btn-sm btn-ghost" onClick={() => set(e, "cancelled")}>Batal</button>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          {data.done.length > 0 && (
            <section aria-labelledby="wl-done">
              <h2 id="wl-done" style={{ marginBottom: 10 }}>Selesai hari ini</h2>
              <div className="panel flush">
                <div className="table-wrap">
                  <table className="table">
                    <tbody>
                      {data.done.map((e) => (
                        <tr key={e.id}>
                          <td className="num strong">A{e.number}</td>
                          <td>{e.name} · {e.party_size} orang</td>
                          <td>{DONE_LABEL[e.status]}{e.table_label ? ` · ${e.table_label}` : ""}</td>
                          <td className="r num muted">{e.done_at ? time(e.done_at) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {mgmt && settings && (
        <div className="guard-grid" style={{ marginTop: 24 }}>
          <section className="panel stack no-print">
            <Switch
              checked={settings.enabled}
              onChange={toggle}
              label="Antrean lewat QR pintu"
              hint="Kalau dimatikan, QR antrean menampilkan pesan untuk bertanya ke kasir. Kasir tetap bisa menambah tamu manual."
            />
            {settings.code && (
              <div className="row wrap">
                <a className="btn btn-sm" href={`/antre/${settings.code}`} target="_blank" rel="noreferrer"><ExternalLink /> Buka halaman tamu</a>
                <button className="btn btn-sm" onClick={() => window.print()}><Printer /> Cetak QR</button>
                <button className="btn btn-sm btn-ghost" onClick={regenerate}><RefreshCw /> Ganti kode</button>
              </div>
            )}
          </section>
          {settings.enabled && settings.code && (
            <div className="qr-grid" style={{ margin: 0 }}>
              <div className="qr-card print-only-card">
                <div className="tiny muted">{tenant?.name}</div>
                <QrImg url={waitUrl(settings.code)} label="Antrean" />
                <div className="label">Antre di sini</div>
                <div className="small muted">Pindai, isi nama, tunggu dipanggil</div>
                <div className="qr-brand">pesan<span className="dot">.</span>in</div>
              </div>
            </div>
          )}
        </div>
      )}
      <AddGuest open={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(true); feed.reload(); }} />
      <Modal
        open={!!seating}
        onClose={() => setSeating(null)}
        title={seating ? `Dudukkan ${seating.name} (A${seating.number})` : ""}
      >
        <div className="stack">
          <p className="small muted">Pilih mejanya supaya tercatat. Boleh dilewati.</p>
          <div className="row wrap">
            {(tables.data?.tables ?? []).filter((t) => t.active).map((t) => (
              <button key={t.id} className="chip" onClick={() => { set(seating!, "seated", { table_label: t.label }); setSeating(null); }}>
                {t.label}{t.open_orders ? " · terisi" : ""}
              </button>
            ))}
          </div>
          <button className="btn" onClick={() => { set(seating!, "seated"); setSeating(null); }}>Dudukkan tanpa memilih meja</button>
        </div>
      </Modal>
    </>
  );
}

function AddGuest({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [party, setParty] = useState(2);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setName("");
      setParty(2);
      setPhone("");
    }
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tambah tamu ke antrean"
      footer={
        <>
          <button className="btn" onClick={onClose}>Batal</button>
          <button
            className="btn btn-primary"
            disabled={busy || !name.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api.post<{ number: number }>("/api/store/waitlist", { name, party, phone });
                toast(`${name} masuk antrean, nomor A${r.number}.`);
                onDone();
              } catch (err) {
                toast((err as Error).message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            Masukkan antrean
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="form-row">
          <Field label="Nama" htmlFor="wl-name"><input id="wl-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus /></Field>
          <Field label="Jumlah orang" htmlFor="wl-party">
            <input id="wl-party" className="input num" inputMode="numeric" value={party} onChange={(e) => setParty(Math.min(50, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)))} />
          </Field>
        </div>
        <Field label="No. WhatsApp (opsional)" htmlFor="wl-phone" hint="Untuk mengabari saat meja siap.">
          <input id="wl-phone" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="0812 3456 7890" />
        </Field>
      </div>
    </Modal>
  );
}
