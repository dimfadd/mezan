import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Film, ImagePlus, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { Empty, ErrorState, Field, Loading, Modal, MoneyInput, PageHead, Switch, Thumb, useConfirm, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { rupiah } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { checkVideo, prepareImage, VIDEO_MAX_SECONDS } from "../../lib/media";
import { isManagement, useSession } from "../../lib/session";
import { TAG_LABEL, type Category, type MenuItem } from "./types";

export function MenuManagePage() {
  const { user, tenant } = useSession();
  const mgmt = isManagement(user?.role);
  const items = useApi<{ items: MenuItem[] }>("/api/store/items");
  const cats = useApi<{ categories: Category[] }>("/api/store/categories");
  const toast = useToast();
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "off">("all");

  const grouped = useMemo(() => {
    const list = (items.data?.items ?? []).filter((i) => filter === "all" || !i.available);
    const cs = cats.data?.categories ?? [];
    const groups = cs.map((c) => ({ id: c.id, name: c.name, items: list.filter((i) => i.category_id === c.id) }));
    const none = list.filter((i) => !i.category_id || !cs.some((c) => c.id === i.category_id));
    if (none.length) groups.push({ id: "none", name: "Tanpa kategori", items: none });
    return groups.filter((g) => g.items.length > 0 || (filter === "all" && mgmt));
  }, [items.data, cats.data, filter, mgmt]);

  const toggle = async (it: MenuItem) => {
    const next = it.available ? 0 : 1;
    items.setData((d) => d && { items: d.items.map((x) => (x.id === it.id ? { ...x, available: next } : x)) });
    try {
      await api.patch(`/api/store/items/${it.id}/availability`, { available: !!next });
      toast(next ? `${it.name} tersedia lagi.` : `${it.name} ditandai habis. Pelanggan tidak bisa memesannya.`);
    } catch (e) {
      toast((e as Error).message, "error");
      items.reload(true);
    }
  };

  const err = items.error ?? cats.error;
  const offCount = items.data?.items.filter((i) => !i.available).length ?? 0;

  return (
    <>
      <PageHead
        title={mgmt ? "Menu & produk" : "Menu"}
        sub={mgmt ? "Yang kamu ubah di sini langsung tampil di menu QR pelanggan." : "Tandai menu yang habis supaya pelanggan tidak memesannya."}
        actions={
          mgmt && (
            <>
              <button className="btn" onClick={() => setCatsOpen(true)}>
                Atur kategori
              </button>
              <button className="btn btn-primary" onClick={() => setEditing({ available: 1, track_stock: 0, low_stock_at: 5, unit: "porsi", tags: "" })}>
                <Plus /> Tambah menu
              </button>
            </>
          )
        }
      />
      <div className="row wrap" style={{ marginBottom: 16 }}>
        <button className="chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          Semua menu
        </button>
        <button className="chip" aria-pressed={filter === "off"} onClick={() => setFilter("off")}>
          Sedang habis ({offCount})
        </button>
      </div>
      {err ? (
        <ErrorState message={err.message} onRetry={() => { items.reload(); cats.reload(); }} />
      ) : items.loading || cats.loading ? (
        <Loading rows={5} height={72} />
      ) : (items.data?.items.length ?? 0) === 0 ? (
        <div className="panel">
          <Empty
            icon={<UtensilsCrossed aria-hidden="true" />}
            title="Menu masih kosong"
            action={mgmt && <button className="btn btn-primary" onClick={() => setEditing({ available: 1, unit: "porsi", tags: "" })}><Plus /> Tambah menu pertama</button>}
          >
            Mulai dari menu yang paling sering dipesan. Foto bisa ditambahkan belakangan.
          </Empty>
        </div>
      ) : grouped.length === 0 ? (
        <div className="panel">
          <Empty title="Tidak ada menu yang habis">Semua menu sedang tersedia.</Empty>
        </div>
      ) : (
        <div className="stack" style={{ gap: 20 }}>
          {grouped.map((g) => (
            <section key={g.id} aria-labelledby={`cat-${g.id}`}>
              <h2 id={`cat-${g.id}`} style={{ marginBottom: 8 }}>
                {g.name} <span className="muted small">({g.items.length})</span>
              </h2>
              <div className="panel flush">
                {g.items.length === 0 ? (
                  <p className="muted small" style={{ padding: 16 }}>Belum ada menu di kategori ini.</p>
                ) : (
                  <div className="menu-rows">
                    {g.items.map((it) => {
                      const low = tenant?.inventory_enabled && it.track_stock && it.stock_qty <= it.low_stock_at;
                      return (
                        <div className="menu-row" key={it.id}>
                          <div className="thumb">
                            <Thumb image={it.image_url} name={it.name} />
                            {it.video_url && (
                              <span className="video-flag" title="Ada video">
                                <Film aria-label="Ada video" />
                              </span>
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="title">{it.name}</div>
                            <div className="meta">
                              <span className="money small strong">{rupiah(it.price)}</span>
                              {!it.available && <span className="badge badge-danger">Habis</span>}
                              {low ? <span className="badge badge-warn">Stok {it.stock_qty} {it.unit}</span> : null}
                              {it.tags.split(",").filter(Boolean).map((t) => (
                                <span key={t} className="badge">{TAG_LABEL[t] ?? t}</span>
                              ))}
                            </div>
                          </div>
                          <div className="acts">
                            <Switch checked={!!it.available} onChange={() => toggle(it)} label={<span className="small">{it.available ? "Tersedia" : "Habis"}</span>} />
                            {mgmt && (
                              <button className="icon-btn" aria-label={`Ubah ${it.name}`} onClick={() => setEditing(it)}>
                                <Pencil />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {mgmt && editing && (
        <ItemEditor
          item={editing}
          categories={cats.data?.categories ?? []}
          allowVideo={!!tenant?.allow_video}
          planName={tenant?.plan_name ?? ""}
          stockOn={!!tenant?.inventory_enabled}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            items.reload(true);
            cats.reload(true);
          }}
        />
      )}
      {mgmt && (
        <CategoryManager
          open={catsOpen}
          categories={cats.data?.categories ?? []}
          onClose={() => setCatsOpen(false)}
          onChanged={() => {
            cats.reload(true);
            items.reload(true);
          }}
        />
      )}
    </>
  );
}

const TAGS = ["favorit", "pedas", "vegetarian", "baru"];

function ItemEditor({
  item,
  categories,
  allowVideo,
  planName,
  stockOn,
  onClose,
  onSaved,
}: {
  item: Partial<MenuItem>;
  categories: Category[];
  allowVideo: boolean;
  planName: string;
  stockOn: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [f, setF] = useState({
    name: item.name ?? "",
    description: item.description ?? "",
    price: (item.price ?? "") as number | "",
    category_id: item.category_id ?? categories[0]?.id ?? "",
    image_url: item.image_url ?? null,
    video_url: item.video_url ?? null,
    tags: (item.tags ?? "").split(",").filter(Boolean),
    available: item.available ?? 1,
    track_stock: item.track_stock ?? 0,
    low_stock_at: item.low_stock_at ?? 5,
    unit: item.unit ?? "porsi",
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"image" | "video" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const imgInput = useRef<HTMLInputElement>(null);
  const vidInput = useRef<HTMLInputElement>(null);
  const isNew = !item.id;

  const upload = async (kind: "image" | "video", file: File | undefined) => {
    if (!file) return;
    setUploading(kind);
    try {
      const ready = kind === "image" ? await prepareImage(file) : await checkVideo(file);
      const r = await api.upload<{ url: string }>("/api/store/media", ready);
      setF((s) => ({ ...s, [kind === "image" ? "image_url" : "video_url"]: r.url }));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setUploading(null);
      if (imgInput.current) imgInput.current.value = "";
      if (vidInput.current) vidInput.current.value = "";
    }
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!f.name.trim()) errs.name = "Nama menu wajib diisi.";
    if (f.price === "") errs.price = "Isi harga. Tulis 0 kalau gratis.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const body = { ...f, category_id: f.category_id || null, tags: f.tags.join(","), price: Number(f.price) };
    try {
      if (isNew) await api.post("/api/store/items", body);
      else await api.put(`/api/store/items/${item.id}`, body);
      toast(isNew ? `${f.name} ditambahkan ke menu.` : "Perubahan disimpan.");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: `Hapus ${item.name}?`, body: "Menu hilang dari daftar pelanggan dan kasir. Riwayat penjualannya tetap tersimpan di laporan.", confirm: "Hapus menu", danger: true }))) return;
    try {
      await api.del(`/api/store/items/${item.id}`);
      toast(`${item.name} dihapus.`);
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={isNew ? "Tambah menu" : `Ubah ${item.name}`}
      footer={
        <>
          {!isNew && (
            <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={remove}>
              <Trash2 /> Hapus
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Batal
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !!uploading}>
            {busy ? "Menyimpan..." : isNew ? "Tambah ke menu" : "Simpan perubahan"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="form-row">
          <Field label="Nama menu" htmlFor="it-name" error={errors.name}>
            <input id="it-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} placeholder="Mis. Nasi Goreng Kampung" autoFocus={isNew} />
          </Field>
          <Field label="Harga" htmlFor="it-price" error={errors.price}>
            <MoneyInput id="it-price" value={f.price} onChange={(v) => setF({ ...f, price: v })} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Kategori" htmlFor="it-cat">
            <select id="it-cat" className="select" value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>
              <option value="">Tanpa kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Satuan" htmlFor="it-unit" hint="Dipakai di stok, mis. porsi, gelas, botol.">
            <input id="it-unit" className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} maxLength={20} />
          </Field>
        </div>
        <Field label="Deskripsi" htmlFor="it-desc" hint="Tulis isi, porsi, atau rasa. Ini yang dibaca pelanggan sebelum memesan.">
          <textarea id="it-desc" className="textarea" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={500} placeholder="Mis. Nasi goreng bumbu terasi, telur ceplok, kerupuk, acar." />
        </Field>

        <div className="field">
          <span className="field-label">Label</span>
          <div className="row wrap">
            {TAGS.map((t) => (
              <button
                key={t}
                type="button"
                className="chip"
                aria-pressed={f.tags.includes(t)}
                onClick={() => setF({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] })}
              >
                {TAG_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <span className="field-label">Foto</span>
            <div className="media-drop">
              {f.image_url ? (
                <div className="media-preview">
                  <img src={f.image_url} alt={`Foto ${f.name}`} />
                </div>
              ) : (
                <p className="small muted">Foto dari HP sudah cukup. Akan diperkecil otomatis supaya cepat dibuka.</p>
              )}
              <div className="row wrap">
                <button type="button" className="btn btn-sm" onClick={() => imgInput.current?.click()} disabled={!!uploading}>
                  <ImagePlus /> {uploading === "image" ? "Mengunggah..." : f.image_url ? "Ganti foto" : "Pilih foto"}
                </button>
                {f.image_url && (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setF({ ...f, image_url: null })}>
                    Lepas foto
                  </button>
                )}
              </div>
              <input ref={imgInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => upload("image", e.target.files?.[0])} />
            </div>
          </div>
          <div className="field">
            <span className="field-label">Video pendek</span>
            <div className="media-drop">
              {!allowVideo ? (
                <p className="small muted">Video menu tersedia mulai paket Kafe. Paket kamu sekarang: {planName}.</p>
              ) : (
                <>
                  {f.video_url ? (
                    <div className="media-preview">
                      <video src={f.video_url} muted loop playsInline autoPlay controls aria-label={`Video ${f.name}`} />
                    </div>
                  ) : (
                    <p className="small muted">
                      MP4 maksimal {VIDEO_MAX_SECONDS} detik. Video pendek tanpa suara (mis. kuah dituang, keju meleleh) lebih menjual daripada foto, dan jauh lebih ringan dari GIF.
                    </p>
                  )}
                  <div className="row wrap">
                    <button type="button" className="btn btn-sm" onClick={() => vidInput.current?.click()} disabled={!!uploading}>
                      <Film /> {uploading === "video" ? "Mengunggah..." : f.video_url ? "Ganti video" : "Pilih video"}
                    </button>
                    {f.video_url && (
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setF({ ...f, video_url: null })}>
                        Lepas video
                      </button>
                    )}
                  </div>
                  <input ref={vidInput} type="file" accept="video/mp4,video/webm" hidden onChange={(e) => upload("video", e.target.files?.[0])} />
                </>
              )}
            </div>
          </div>
        </div>

        <Switch checked={!!f.available} onChange={(v) => setF({ ...f, available: v ? 1 : 0 })} label="Tersedia untuk dipesan" hint="Matikan kalau sedang habis. Menu tetap terlihat dengan tanda Habis." />
        {stockOn && (
          <>
            <Switch checked={!!f.track_stock} onChange={(v) => setF({ ...f, track_stock: v ? 1 : 0 })} label="Hitung stok menu ini" hint="Cocok untuk barang jadi (minuman botol, kerupuk). Stok berkurang otomatis tiap terjual. Isi jumlahnya di halaman Stok." />
            {!!f.track_stock && (
              <Field label="Ingatkan kalau stok tinggal" htmlFor="it-low">
                <input id="it-low" className="input num" style={{ maxWidth: 160 }} inputMode="numeric" value={f.low_stock_at} onChange={(e) => setF({ ...f, low_stock_at: Number(e.target.value.replace(/\D/g, "") || 0) })} />
              </Field>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function CategoryManager({ open, categories, onClose, onChanged }: { open: boolean; categories: Category[]; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast(ok);
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const move = (i: number, d: number) => {
    const ids = categories.map((c) => c.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    run(() => api.post("/api/store/categories/reorder", { ids }));
  };

  return (
    <Modal open={open} onClose={onClose} title="Kategori menu">
      <div className="stack">
        <p className="small muted">Urutan di sini sama dengan urutan di menu pelanggan.</p>
        {categories.length === 0 && <p className="muted">Belum ada kategori.</p>}
        {categories.map((c, i) => (
          <div key={c.id} className="row" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
            {editId === c.id ? (
              <form
                className="row"
                style={{ flex: 1 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => api.put(`/api/store/categories/${c.id}`, { name: editName }), "Nama kategori diubah.");
                  setEditId(null);
                }}
              >
                <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus maxLength={40} aria-label="Nama kategori" />
                <button className="btn btn-primary btn-sm" type="submit">Simpan</button>
              </form>
            ) : (
              <>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="strong">{c.name}</span> <span className="muted small">{c.item_count ?? 0} menu</span>
                </span>
                <button className="icon-btn" aria-label={`Naikkan ${c.name}`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></button>
                <button className="icon-btn" aria-label={`Turunkan ${c.name}`} disabled={i === categories.length - 1} onClick={() => move(i, 1)}><ArrowDown /></button>
                <button className="icon-btn" aria-label={`Ganti nama ${c.name}`} onClick={() => { setEditId(c.id); setEditName(c.name); }}><Pencil /></button>
                <button
                  className="icon-btn"
                  aria-label={`Hapus ${c.name}`}
                  onClick={async () => {
                    if (await confirm({ title: `Hapus kategori ${c.name}?`, body: c.item_count ? `${c.item_count} menu di dalamnya tidak ikut terhapus, hanya pindah ke "Tanpa kategori".` : "Kategori ini kosong.", confirm: "Hapus kategori", danger: true })) {
                      run(() => api.del(`/api/store/categories/${c.id}`), "Kategori dihapus.");
                    }
                  }}
                >
                  <Trash2 />
                </button>
              </>
            )}
          </div>
        ))}
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            run(() => api.post("/api/store/categories", { name }), `Kategori ${name} ditambahkan.`);
            setName("");
          }}
        >
          <input className="input" placeholder="Nama kategori baru, mis. Paket Hemat" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Nama kategori baru" />
          <button className="btn btn-primary" type="submit">
            <Plus /> Tambah
          </button>
        </form>
      </div>
    </Modal>
  );
}
