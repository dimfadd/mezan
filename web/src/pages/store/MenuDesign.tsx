import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, ImagePlus, Lock, RotateCcw, UtensilsCrossed } from "lucide-react";
import { Field, Loading, PageHead, Segmented, Thumb, useConfirm, useToast } from "../../components/ui";
import { ThemedRoot } from "../../components/ThemedRoot";
import { api } from "../../lib/api";
import { rupiah } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { prepareImage } from "../../lib/media";
import { useSession } from "../../lib/session";
import {
  BODY_FONTS, checkTheme, DEFAULT_THEME, HEADING_FONTS, normalizeTheme, PRESETS,
  type Layout, type MenuTheme, type Radius,
} from "../../../../shared/menuTheme";
import { TAG_LABEL, type Category, type DiningTable, type MenuItem } from "./types";

const COLOR_FIELDS: { key: "bg" | "surface" | "ink" | "brand" | "accent"; label: string; hint: string }[] = [
  { key: "bg", label: "Latar halaman", hint: "Warna paling belakang" },
  { key: "surface", label: "Kartu menu", hint: "Kotak tiap menu & jendela detail" },
  { key: "ink", label: "Teks", hint: "Nama menu, deskripsi, harga" },
  { key: "brand", label: "Warna utama", hint: "Tombol Tambah & Kirim pesanan" },
  { key: "accent", label: "Tombol keranjang", hint: "Bar keranjang di bawah layar" },
];

function ColorField({ label, hint, value, onChange, flagged }: { label: string; hint: string; value: string; onChange: (v: string) => void; flagged: boolean }) {
  const [text, setText] = useState(value);
  const id = `c-${label.replace(/\s/g, "")}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="row" style={{ gap: 8 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setText(e.target.value);
          }}
          aria-label={`Pilih ${label}`}
          style={{ width: 48, height: 44, padding: 2, border: `1px solid ${flagged ? "var(--danger)" : "var(--line-strong)"}`, borderRadius: "var(--radius)", background: "var(--surface)", cursor: "pointer", flex: "none" }}
        />
        <input
          id={id}
          className="input num"
          value={text}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value.trim();
            setText(v);
            if (/^#[0-9a-f]{6}$/i.test(v)) onChange(v.toLowerCase());
          }}
          onBlur={() => setText(value)}
          style={flagged ? { borderColor: "var(--danger)" } : undefined}
        />
      </div>
      <span className="hint">{hint}</span>
    </div>
  );
}

function MediaPick({ label, hint, url, onChange }: { label: string; hint: string; url: string | null; onChange: (u: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="media-drop">
        {url ? <img src={url} alt="" style={{ maxHeight: 96, maxWidth: 160, objectFit: "cover", borderRadius: "var(--radius-sm)" }} /> : <p className="small muted">{hint}</p>}
        <div className="row wrap">
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => ref.current?.click()}>
            <ImagePlus /> {busy ? "Mengunggah..." : url ? "Ganti" : "Pilih gambar"}
          </button>
          {url && <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange(null)}>Lepas</button>}
        </div>
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try {
              const r = await api.upload<{ url: string }>("/api/store/media", await prepareImage(f));
              onChange(r.url);
            } catch (err) {
              toast((err as Error).message, "error");
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </div>
    </div>
  );
}

export function MenuDesignPage() {
  const { tenant, refresh } = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const items = useApi<{ items: MenuItem[] }>("/api/store/items");
  const cats = useApi<{ categories: Category[] }>("/api/store/categories");
  const tables = useApi<{ tables: DiningTable[] }>("/api/store/tables");
  const sub = useApi<{ plans: { name: string; allow_branding: number; price_monthly: number }[] }>("/api/store/subscription");
  const saved = useMemo(() => {
    try {
      return normalizeTheme(JSON.parse(tenant?.menu_theme || "{}"));
    } catch {
      return DEFAULT_THEME;
    }
  }, [tenant?.menu_theme]);
  const [t, setT] = useState<MenuTheme>(saved);
  const [busy, setBusy] = useState(false);
  const [colorKey, setColorKey] = useState(0); // paksa isi ulang kolom hex saat preset dipilih
  if (!tenant) return <Loading />;

  const allowed = !!tenant.allow_branding;
  const issues = checkTheme(t);
  const flagged = new Set(issues.map((i) => i.field));
  const dirty = JSON.stringify(t) !== JSON.stringify(saved);
  const firstTable = tables.data?.tables.find((x) => x.active);
  const premiumPlan = sub.data?.plans.find((p) => p.allow_branding);
  const set = <K extends keyof MenuTheme>(k: K, v: MenuTheme[K]) => setT((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await api.put("/api/store/theme", t);
      await refresh();
      toast("Tampilan menu disimpan. Pelanggan melihatnya saat membuka QR berikutnya.");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const preview = (
    <ThemePreview theme={allowed ? t : DEFAULT_THEME} storeName={tenant.name} note={tenant.welcome_note} items={items.data?.items ?? []} categories={cats.data?.categories ?? []} />
  );

  if (!allowed) {
    return (
      <>
        <PageHead title="Tampilan menu" sub="Atur warna, font, dan latar menu QR supaya terasa milik usahamu sendiri." />
        <div className="design-layout">
          <div className="stack">
            <div className="panel stack">
              <div className="row"><Lock aria-hidden="true" style={{ width: 20, height: 20, color: "var(--ink-2)" }} /><h2>Paket {tenant.plan_name} memakai tampilan template</h2></div>
              <p className="muted">
                Menu QR kamu sekarang memakai tampilan bawaan Pesan.in (seperti pratinjau di samping). Tampilan ini sudah dirancang mudah dibaca di HP, jadi tidak wajib diubah.
              </p>
              <p className="muted">
                {premiumPlan
                  ? <>Paket <strong>{premiumPlan.name}</strong> ({rupiah(premiumPlan.price_monthly)}/bulan) membuka pengaturan warna, font, sudut kartu, gambar latar, logo, dan tata letak galeri foto.</>
                  : "Belum ada paket yang membuka pengaturan tampilan."}{" "}
                Hubungi admin Pesan.in untuk pindah paket.
              </p>
            </div>
          </div>
          <div className="design-preview">{preview}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Tampilan menu"
        sub="Yang kamu ubah di sini hanya berlaku untuk menu QR pelanggan. Layar kasir tetap memakai tampilan Pesan.in."
        actions={firstTable && (
          <a className="btn" href={`/m/${firstTable.code}`} target="_blank" rel="noreferrer">Buka menu asli</a>
        )}
      />
      <div className="design-layout">
        <div className="stack" style={{ gap: 20 }}>
          <section className="panel">
            <div className="panel-head"><div><h2>Mulai dari gaya jadi</h2><p>Pilih satu, lalu sesuaikan warnanya di bawah.</p></div></div>
            <div className="row wrap">
              {PRESETS.map((p) => {
                const th = normalizeTheme({ ...DEFAULT_THEME, ...p.theme, logo: t.logo, bgImage: t.bgImage });
                return (
                  <button key={p.id} type="button" className="preset" onClick={() => { setT(th); setColorKey((k) => k + 1); }}>
                    <span className="swatches" aria-hidden="true">
                      {[th.bg, th.surface, th.brand, th.accent].map((c, i) => <span key={i} style={{ background: c }} />)}
                    </span>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Warna</h2></div>
            {issues.length > 0 && (
              <div className="banner danger" role="alert">
                <AlertTriangle aria-hidden="true" />
                <div className="stack-sm">{issues.map((i) => <span key={i.field}>{i.message}</span>)}</div>
              </div>
            )}
            <div className="form-row" key={colorKey}>
              {COLOR_FIELDS.map((f) => (
                <ColorField key={f.key} label={f.label} hint={f.hint} value={t[f.key]} flagged={flagged.has(f.key)} onChange={(v) => set(f.key, v)} />
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Huruf & bentuk</h2></div>
            <div className="form-grid">
              <div className="form-row">
                <Field label="Font judul" htmlFor="f-head" hint={HEADING_FONTS.find((f) => f.id === t.headingFont)?.note}>
                  <select id="f-head" className="select" value={t.headingFont} onChange={(e) => set("headingFont", e.target.value)}>
                    {HEADING_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </Field>
                <Field label="Font isi" htmlFor="f-body" hint={BODY_FONTS.find((f) => f.id === t.bodyFont)?.note}>
                  <select id="f-body" className="select" value={t.bodyFont} onChange={(e) => set("bodyFont", e.target.value)}>
                    {BODY_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </Field>
              </div>
              <div className="form-row">
                <div className="field">
                  <span className="field-label">Sudut kartu</span>
                  <Segmented<Radius> label="Sudut kartu" value={t.radius} onChange={(v) => set("radius", v)} options={[{ value: "tajam", label: "Tajam" }, { value: "sedang", label: "Sedang" }, { value: "bulat", label: "Bulat" }]} />
                </div>
                <div className="field">
                  <span className="field-label">Tata letak menu</span>
                  <Segmented<Layout> label="Tata letak menu" value={t.layout} onChange={(v) => set("layout", v)} options={[{ value: "list", label: "Daftar" }, { value: "grid", label: "Galeri foto" }]} />
                  <span className="hint">{t.layout === "grid" ? "Foto besar 2 kolom. Bagus kalau semua menu punya foto." : "Foto kecil di samping. Aman walau belum semua menu berfoto."}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Logo & latar</h2></div>
            <div className="form-row">
              <MediaPick label="Logo" hint="Persegi, minimal 200 x 200 px." url={t.logo} onChange={(u) => set("logo", u)} />
              <MediaPick label="Gambar latar" hint="Mis. foto interior atau tekstur. Diberi lapisan warna latar supaya teks tetap terbaca." url={t.bgImage} onChange={(u) => set("bgImage", u)} />
            </div>
          </section>

          <div className="save-bar">
            <button
              type="button"
              className="btn"
              onClick={async () => {
                if (await confirm({ title: "Kembali ke tampilan template?", body: "Semua warna, font, logo, dan latar kembali ke bawaan Pesan.in. Belum tersimpan sampai kamu menekan Simpan.", confirm: "Kembalikan" })) {
                  setT(DEFAULT_THEME);
                  setColorKey((k) => k + 1);
                }
              }}
            >
              <RotateCcw /> Template bawaan
            </button>
            <button type="button" className="btn btn-primary btn-lg" disabled={busy || !dirty || issues.length > 0} onClick={save}>
              {busy ? "Menyimpan..." : dirty ? "Simpan tampilan" : "Tersimpan"}
            </button>
          </div>
        </div>
        <div className="design-preview">{preview}</div>
      </div>
    </>
  );
}

/** Pratinjau menu pelanggan memakai data menu asli. Hanya tampilan, tidak bisa diklik. */
function ThemePreview({ theme, storeName, note, items, categories }: { theme: MenuTheme; storeName: string; note: string; items: MenuItem[]; categories: Category[] }) {
  const firstCat = categories.find((c) => items.some((i) => i.category_id === c.id));
  const shown = (firstCat ? items.filter((i) => i.category_id === firstCat.id) : items).slice(0, 4);
  return (
    <div>
      <p className="tiny muted" style={{ marginBottom: 8, textAlign: "center" }}>Pratinjau di HP pelanggan</p>
      <div className="phone-frame" aria-label="Pratinjau tampilan menu" role="img">
        <ThemedRoot theme={theme} className="cust-root theme-preview">
          <div className="cust-head">
            {theme.logo && <img className="cust-logo" src={theme.logo} alt="" />}
            <span className="table-tag"><UtensilsCrossed aria-hidden="true" /> Meja 1</span>
            <div className="store">{storeName}</div>
            {note && <p className="muted small">{note}</p>}
          </div>
          <div className="cust-section">
            <h2>{firstCat?.name ?? "Menu"}</h2>
            {shown.length === 0 ? (
              <p className="muted small">Tambahkan menu dulu supaya pratinjau terisi.</p>
            ) : (
              <div className="dish-list">
                {shown.map((d) => (
                  <div key={d.id} className="dish" style={{ cursor: "default" }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="name">{d.name}</div>
                      {d.description && <div className="desc">{d.description}</div>}
                      <div className="price">{rupiah(d.price)}</div>
                      <div className="tags">
                        {d.tags.split(",").filter(Boolean).slice(0, 2).map((tg) => <span key={tg} className="badge">{TAG_LABEL[tg] ?? tg}</span>)}
                      </div>
                    </div>
                    <div className="media"><Thumb image={d.image_url} name={d.name} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ padding: "4px 16px 14px" }}>
            <span className="btn btn-primary btn-block" aria-hidden="true">Tambah · {rupiah(shown[0]?.price ?? 15000)}</span>
          </div>
          <div className="cartbar" aria-hidden="true">
            <span>2 item · <span className="money">{rupiah((shown[0]?.price ?? 15000) * 2)}</span></span>
            <span className="go">Lihat pesanan <ChevronRight aria-hidden="true" /></span>
          </div>
        </ThemedRoot>
      </div>
      <p className="tiny muted" style={{ marginTop: 8, textAlign: "center" }}>
        <Link to="/toko/menu">Foto menu</Link> diatur di halaman Menu & produk.
      </p>
    </div>
  );
}
