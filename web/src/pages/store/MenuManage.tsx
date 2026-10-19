import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Film, ImagePlus, Pencil, Plus, Star, ThumbsUp, Trash2, UtensilsCrossed } from "lucide-react";
import { Empty, ErrorState, Field, Loading, Modal, MoneyInput, PageHead, Switch, Thumb, useConfirm, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { rupiah } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { VIDEO_MAX_SECONDS } from "../../lib/media";
import { uploadMedia } from "../../lib/upload";
import { mediaSummary, type MediaRef } from "../../components/Gallery";
import { Chilis } from "../../components/DishInfo";
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
  const [filter, setFilter] = useState<"all" | "off" | "noen">("all");

  const grouped = useMemo(() => {
    const list = (items.data?.items ?? []).filter((i) => filter === "all" || (filter === "off" ? !i.available : !i.name_en && !i.description_en));
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
        {mgmt && (items.data?.items.length ?? 0) > 0 && (
          <button className="chip" aria-pressed={filter === "noen"} onClick={() => setFilter("noen")}>
            Belum ada versi Inggris ({items.data!.items.filter((i) => !i.name_en && !i.description_en).length})
          </button>
        )}
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
          {filter === "off" ? <Empty title="Tidak ada menu yang habis">Semua menu sedang tersedia.</Empty> : <Empty title="Semua menu sudah punya versi Inggris">Pembeli asing bisa membaca seluruh menu.</Empty>}
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
                            {it.media.length > 1 && (
                              <span className="video-flag" title={mediaSummary(it.media)}>
                                {it.media.some((m) => m.kind === "video") ? <Film aria-hidden="true" /> : null}
                                <span className="tiny" style={{ fontSize: 10 }}>{it.media.length}</span>
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
          limits={{ photos: tenant?.max_photos ?? 3, videos: tenant?.allow_video ? tenant.max_videos : 0 }}
          tenantId={tenant?.id ?? ""}
          planName={tenant?.plan_name ?? ""}
          stockOn={!!tenant?.inventory_enabled}
          salesNote={salesNote(editing, items.data?.items ?? [])}
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

const TAGS = ["bestseller", "favorit", "pedas", "vegetarian", "baru"];

/** Bantu pemilik memutuskan label Best seller dari data penjualan, bukan perasaan. */
function salesNote(item: Partial<MenuItem>, all: MenuItem[]) {
  if (!item.id) return null;
  const sold = item.sold_30d ?? 0;
  if (sold === 0) return "Belum terjual dalam 30 hari terakhir.";
  const rank = all.filter((i) => (i.sold_30d ?? 0) > sold).length + 1;
  return `Terjual ${sold} dalam 30 hari terakhir, urutan ${rank} dari ${all.length} menu.${rank <= 3 ? " Cocok diberi label Best seller." : ""}`;
}

function ItemEditor({
  item,
  categories,
  limits,
  tenantId,
  planName,
  stockOn,
  salesNote,
  onClose,
  onSaved,
}: {
  item: Partial<MenuItem>;
  categories: Category[];
  limits: { photos: number; videos: number };
  tenantId: string;
  planName: string;
  stockOn: boolean;
  salesNote?: string | null;
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
    media: item.media ?? [],
    portion: item.portion ?? "",
    components: item.components ?? "",
    spice_level: item.spice_level ?? null,
    prep_minutes: (item.prep_minutes ?? "") as number | "",
    allergens: item.allergens ?? "",
    name_en: item.name_en ?? "",
    description_en: item.description_en ?? "",
    portion_en: item.portion_en ?? "",
    components_en: item.components_en ?? "",
    allergens_en: item.allergens_en ?? "",
    tags: (item.tags ?? "").split(",").filter(Boolean),
    available: item.available ?? 1,
    track_stock: item.track_stock ?? 0,
    low_stock_at: item.low_stock_at ?? 5,
    unit: item.unit ?? "porsi",
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isNew = !item.id;

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!f.name.trim()) errs.name = "Nama menu wajib diisi.";
    if (f.price === "") errs.price = "Isi harga. Tulis 0 kalau gratis.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const body = { ...f, category_id: f.category_id || null, tags: f.tags.join(","), price: Number(f.price), prep_minutes: f.prep_minutes === "" ? null : f.prep_minutes };
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
                {t === "bestseller" && <ThumbsUp aria-hidden="true" />}
                {TAG_LABEL[t]}
              </button>
            ))}
          </div>
          <span className="hint">
            Best seller tampil sebagai stempel di foto menu pembeli.{salesNote ? ` ${salesNote}` : ""}
          </span>
        </div>

        <GalleryEditor
          media={f.media}
          onChange={(media) => setF((s) => ({ ...s, media }))}
          onBusy={setUploading}
          tenantId={tenantId}
          limits={limits}
          planName={planName}
          name={f.name}
        />

        <section className="stack" aria-labelledby="it-detail-h" style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          <div>
            <h3 id="it-detail-h">Biar pembeli terbayang</h3>
            <p className="small muted" style={{ marginTop: 4 }}>Semua boleh dikosongkan. Yang diisi akan tampil saat pembeli membuka detail menu.</p>
          </div>
          <div className="form-row">
            <Field label="Porsi" htmlFor="it-portion" hint="Mis. 1 orang, cukup berdua, 250 gram, gelas 400 ml">
              <input id="it-portion" className="input" value={f.portion} onChange={(e) => setF({ ...f, portion: e.target.value })} maxLength={40} />
            </Field>
            <Field label="Perkiraan waktu saji (menit)" htmlFor="it-prep" hint="Dihitung dari pesanan diterima dapur">
              <input id="it-prep" className="input num" inputMode="numeric" value={f.prep_minutes} onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 3); setF({ ...f, prep_minutes: d === "" ? "" : Number(d) }); }} />
            </Field>
          </div>
          <Field label="Isi / komponen" htmlFor="it-comp" hint="Satu per baris. Tampil sebagai daftar centang.">
            <textarea id="it-comp" className="textarea" value={f.components} onChange={(e) => setF({ ...f, components: e.target.value })} maxLength={400} placeholder={"Nasi goreng terasi\nTelur ceplok\nKerupuk udang"} />
          </Field>
          <div className="field">
            <span className="field-label">Level pedas</span>
            <div className="row wrap" role="group" aria-label="Level pedas">
              <button type="button" className="chip" aria-pressed={f.spice_level === null} onClick={() => setF({ ...f, spice_level: null })}>Tidak diisi</button>
              <button type="button" className="chip" aria-pressed={f.spice_level === 0} onClick={() => setF({ ...f, spice_level: 0 })}>Tidak pedas</button>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className="chip" aria-pressed={f.spice_level === n} onClick={() => setF({ ...f, spice_level: n })} aria-label={`Pedas level ${n}`}>
                  <Chilis level={n} />
                </button>
              ))}
            </div>
          </div>
          <Field label="Alergen / pantangan" htmlFor="it-allergen" hint="Mis. mengandung kacang, udang, susu">
            <input id="it-allergen" className="input" value={f.allergens} onChange={(e) => setF({ ...f, allergens: e.target.value })} maxLength={120} />
          </Field>
        </section>


        <details className="en-block" open={!!(f.name_en || f.description_en)}>
          <summary>
            <span className="strong">English, untuk pembeli asing</span>
            <span className="small muted"> · opsional{f.name_en || f.description_en ? " · sudah diisi" : ""}</span>
          </summary>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <p className="small muted">
              Tampil saat pembeli memilih bahasa EN. Nama asli tetap ditampilkan paling atas supaya pelayan paham saat pembeli menyebutnya; nama Inggris jadi keterangan di bawahnya. Yang dikosongkan memakai versi Indonesia.
            </p>
            <Field label="Nama dalam bahasa Inggris" htmlFor="it-name-en" hint='Mis. "Village-style fried rice". Jelaskan, tidak perlu diterjemahkan kata per kata.'>
              <input id="it-name-en" className="input" lang="en" value={f.name_en} onChange={(e) => setF({ ...f, name_en: e.target.value })} maxLength={80} />
            </Field>
            <Field label="Deskripsi (EN)" htmlFor="it-desc-en">
              <textarea id="it-desc-en" className="textarea" lang="en" value={f.description_en} onChange={(e) => setF({ ...f, description_en: e.target.value })} maxLength={500} />
            </Field>
            <div className="form-row">
              <Field label="Porsi (EN)" htmlFor="it-portion-en" hint="Mis. 1 person, 400 ml glass">
                <input id="it-portion-en" className="input" lang="en" value={f.portion_en} onChange={(e) => setF({ ...f, portion_en: e.target.value })} maxLength={40} />
              </Field>
              <Field label="Alergen (EN)" htmlFor="it-allergen-en" hint="Mis. Contains peanuts">
                <input id="it-allergen-en" className="input" lang="en" value={f.allergens_en} onChange={(e) => setF({ ...f, allergens_en: e.target.value })} maxLength={120} />
              </Field>
            </div>
            <Field label="Isi / komponen (EN)" htmlFor="it-comp-en" hint="Satu per baris, urutannya sama dengan versi Indonesia.">
              <textarea id="it-comp-en" className="textarea" lang="en" value={f.components_en} onChange={(e) => setF({ ...f, components_en: e.target.value })} maxLength={400} />
            </Field>
          </div>
        </details>

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
  const [editEn, setEditEn] = useState("");
  const [nameEn, setNameEn] = useState("");

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
                className="row wrap"
                style={{ flex: 1 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => api.put(`/api/store/categories/${c.id}`, { name: editName, name_en: editEn }), "Nama kategori diubah.");
                  setEditId(null);
                }}
              >
                <input className="input" style={{ flex: "1 1 140px", width: "auto" }} value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus maxLength={40} aria-label="Nama kategori" />
                <input className="input" style={{ flex: "1 1 120px", width: "auto" }} lang="en" value={editEn} onChange={(e) => setEditEn(e.target.value)} maxLength={40} placeholder="English" aria-label="Nama kategori dalam bahasa Inggris" />
                <button className="btn btn-primary btn-sm" type="submit">Simpan</button>
              </form>
            ) : (
              <>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="strong">{c.name}</span>
                  {c.name_en && <span className="small muted"> · EN: {c.name_en}</span>}
                  <span className="muted small"> · {c.item_count ?? 0} menu</span>
                </span>
                <button className="icon-btn" aria-label={`Naikkan ${c.name}`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></button>
                <button className="icon-btn" aria-label={`Turunkan ${c.name}`} disabled={i === categories.length - 1} onClick={() => move(i, 1)}><ArrowDown /></button>
                <button className="icon-btn" aria-label={`Ganti nama ${c.name}`} onClick={() => { setEditId(c.id); setEditName(c.name); setEditEn(c.name_en ?? ""); }}><Pencil /></button>
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
          className="row wrap"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            run(() => api.post("/api/store/categories", { name, name_en: nameEn }), `Kategori ${name} ditambahkan.`);
            setName("");
            setNameEn("");
          }}
        >
          <input className="input" style={{ flex: "1 1 160px", width: "auto" }} placeholder="Kategori baru, mis. Paket Hemat" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Nama kategori baru" />
          <input className="input" style={{ flex: "1 1 120px", width: "auto" }} lang="en" placeholder="English (opsional)" value={nameEn} onChange={(e) => setNameEn(e.target.value)} maxLength={40} aria-label="Nama kategori baru dalam bahasa Inggris" />
          <button className="btn btn-primary" type="submit">
            <Plus /> Tambah
          </button>
        </form>
      </div>
    </Modal>
  );
}

/** Kelola galeri satu menu: urutkan, jadikan sampul, hapus, tambah foto/video sesuai batas paket. */
function GalleryEditor({
  media,
  onChange,
  onBusy,
  tenantId,
  limits,
  planName,
  name,
}: {
  media: MediaRef[];
  onChange: (m: MediaRef[]) => void;
  onBusy: (b: boolean) => void;
  tenantId: string;
  limits: { photos: number; videos: number };
  planName: string;
  name: string;
}) {
  const toast = useToast();
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(0);
  const latest = useRef(media);
  latest.current = media;
  const photos = media.filter((m) => m.kind === "image").length;
  const videos = media.length - photos;

  const add = async (files: FileList | null, kind: "image" | "video") => {
    if (!files?.length) return;
    const room = kind === "image" ? limits.photos - photos : limits.videos - videos;
    const list = [...files].slice(0, Math.max(0, room));
    if (files.length > list.length) toast(`Paket ${planName} maksimal ${kind === "image" ? `${limits.photos} foto` : `${limits.videos} video`} per menu. ${files.length - list.length} file dilewati.`, "error");
    if (!list.length) return;
    setPending((n) => n + list.length);
    onBusy(true);
    // Unggah berurutan supaya urutan galeri sama dengan urutan file yang dipilih.
    for (const file of list) {
      try {
        const m = await uploadMedia(file, tenantId);
        onChange([...latest.current, m]);
      } catch (e) {
        toast(`${file.name}: ${(e as Error).message}`, "error");
      } finally {
        setPending((n) => n - 1);
      }
    }
    onBusy(false);
    if (photoInput.current) photoInput.current.value = "";
    if (videoInput.current) videoInput.current.value = "";
  };

  const move = (i: number, to: number) => {
    if (to < 0 || to >= media.length) return;
    const next = [...media];
    const [x] = next.splice(i, 1);
    next.splice(to, 0, x);
    onChange(next);
  };
  const coverIdx = media.findIndex((m) => m.kind === "image");

  return (
    <div className="field">
      <div className="row between wrap">
        <span className="field-label">Foto & video</span>
        <span className="small muted">
          {photos}/{limits.photos} foto{limits.videos > 0 ? ` · ${videos}/${limits.videos} video` : ""}
        </span>
      </div>
      <div className="media-drop">
        {media.length === 0 && pending === 0 && (
          <p className="small muted">
            Tambahkan beberapa sudut: tampak atas, potongan isi, porsi di piring, sampai suasana saat disajikan. Foto pertama jadi sampul di daftar menu. Foto dari HP sudah cukup, akan diperkecil otomatis.
          </p>
        )}
        {(media.length > 0 || pending > 0) && (
          <div className="gal-grid">
            {media.map((m, i) => (
              <div className="gal-tile" key={m.url}>
                <div className="pic">
                  {m.kind === "image" ? <img src={m.url} alt={`${name} foto ${i + 1}`} /> : <video src={`${m.url}#t=0.5`} muted playsInline preload="metadata" aria-label={`${name} video ${i + 1}`} />}
                </div>
                <span className="tag">
                  {i === coverIdx ? <span className="badge badge-new">Sampul</span> : m.kind === "video" ? <span className="badge"><Film aria-hidden="true" /> Video</span> : null}
                </span>
                <div className="acts">
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Geser ${m.kind === "image" ? "foto" : "video"} ${i + 1} ke kiri`}><ArrowLeft /></button>
                  {m.kind === "image" && i !== coverIdx ? (
                    <button type="button" onClick={() => move(i, 0)} aria-label={`Jadikan foto ${i + 1} sampul`} title="Jadikan sampul"><Star /></button>
                  ) : <span style={{ width: 30 }} />}
                  <button type="button" onClick={() => onChange(media.filter((_, k) => k !== i))} aria-label={`Hapus ${m.kind === "image" ? "foto" : "video"} ${i + 1}`}><Trash2 /></button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === media.length - 1} aria-label={`Geser ${m.kind === "image" ? "foto" : "video"} ${i + 1} ke kanan`}><ArrowRight /></button>
                </div>
              </div>
            ))}
            {Array.from({ length: pending }, (_, k) => (
              <div className="gal-tile busy" key={`p${k}`} aria-live="polite">Mengunggah...</div>
            ))}
          </div>
        )}
        <div className="row wrap">
          <button type="button" className="btn btn-sm" onClick={() => photoInput.current?.click()} disabled={photos >= limits.photos}>
            <ImagePlus /> Tambah foto
          </button>
          {limits.videos > 0 ? (
            <button type="button" className="btn btn-sm" onClick={() => videoInput.current?.click()} disabled={videos >= limits.videos}>
              <Film /> Tambah video
            </button>
          ) : (
            <span className="small muted">Video menu tersedia mulai paket Kafe.</span>
          )}
        </div>
        {limits.videos > 0 && (
          <p className="tiny muted">
            Video: MP4, maksimal {VIDEO_MAX_SECONDS} detik. Gerakan pendek tanpa suara (kuah dituang, keju meleleh) lebih menjual dari foto dan jauh lebih ringan dari GIF.
          </p>
        )}
        <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => add(e.target.files, "image")} />
        <input ref={videoInput} type="file" accept="video/mp4,video/webm" hidden onChange={(e) => add(e.target.files, "video")} />
      </div>
    </div>
  );
}
