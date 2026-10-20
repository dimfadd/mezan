import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Empty, ErrorState, Field, Loading, Modal, PageHead, Segmented, Switch, useConfirm, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import {
  FEATURES, FEATURE_KEYS, SOLUTION_ICONS, type FeatureKey, type FooterColumn, type NavGroup, type Site, type SiteFooter, type SiteKey, type SiteLink,
  type Solution, type SolutionIcon, type Testimonial,
} from "../../../../shared/site";

type Tab = SiteKey;
const TABS: { value: Tab; label: string }[] = [
  { value: "nav", label: "Menu atas" },
  { value: "solutions", label: "Solusi bisnis" },
  { value: "testimonials", label: "Testimoni" },
  { value: "footer", label: "Footer" },
];
const ICON_LABEL: Record<SolutionIcon, string> = { coffee: "Kopi", utensils: "Restoran", store: "Warung", cake: "Kafe/kue", soup: "Bakso/soto", sandwich: "Roti", shirt: "Baju", bag: "Toko/aksesoris" };

function move<T>(list: T[], i: number, d: -1 | 1) {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Tombol naik/turun/hapus untuk baris daftar. */
function RowTools({ i, n, onMove, onRemove, label }: { i: number; n: number; onMove: (d: -1 | 1) => void; onRemove: () => void; label: string }) {
  return (
    <span className="sc-tools">
      <button type="button" className="icon-btn" aria-label={`Naikkan ${label}`} disabled={i === 0} onClick={() => onMove(-1)}><ArrowUp /></button>
      <button type="button" className="icon-btn" aria-label={`Turunkan ${label}`} disabled={i === n - 1} onClick={() => onMove(1)}><ArrowDown /></button>
      <button type="button" className="icon-btn" aria-label={`Hapus ${label}`} onClick={onRemove}><Trash2 /></button>
    </span>
  );
}

function LinksEditor({ links, onChange, max = 10, withDesc = false }: { links: SiteLink[]; onChange: (l: SiteLink[]) => void; max?: number; withDesc?: boolean }) {
  return (
    <div className="sc-links">
      {links.map((l, i) => (
        <div key={i} className="sc-link">
          <input className="input" aria-label="Label tautan" placeholder="Label" value={l.label} maxLength={60} onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <input className="input" aria-label="Alamat tautan" placeholder="/#bagian atau https://" value={l.href} maxLength={300} onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, href: e.target.value.trim() } : x)))} />
          {withDesc && <input className="input" aria-label="Keterangan singkat" placeholder="Keterangan (opsional)" value={l.desc ?? ""} maxLength={120} onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))} />}
          <RowTools i={i} n={links.length} label={l.label || "tautan"} onMove={(d) => onChange(move(links, i, d))} onRemove={() => onChange(links.filter((_, j) => j !== i))} />
        </div>
      ))}
      {links.length < max && (
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange([...links, { label: "", href: "/" }])}><Plus /> Tambah tautan</button>
      )}
    </div>
  );
}

const HREF_HINT = "Alamat: /#simulasi, /#antrean, /#mudah, /#pembeli, /#untung, /#pantau, /#fitur, /#paket, /solusi/<alamat>, /syarat, /privasi, https://..., atau mailto:...";

export function AdminSite() {
  const { data, error, loading, reload } = useApi<{ site: Site; defaults: Site }>("/api/platform/site");
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("nav");
  const [draft, setDraft] = useState<Site | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data && !draft) setDraft(structuredClone(data.site));
  }, [data, draft]);

  if (error && !data) return <ErrorState message={error.message} onRetry={() => reload()} />;
  if (loading || !data || !draft) return <Loading rows={4} />;

  const dirty = JSON.stringify(draft[tab]) !== JSON.stringify(data.site[tab]);
  const set = <K extends SiteKey>(k: K, v: Site[K]) => setDraft({ ...draft, [k]: v });
  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/api/platform/site/${tab}`, draft[tab]);
      await reload(true);
      toast("Tersimpan. Landing page memakai isi baru dalam kurang dari satu menit.");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    if (!(await confirm({ title: `Kembalikan "${TABS.find((t) => t.value === tab)!.label}" ke isi bawaan?`, body: "Isi yang sudah kamu ubah di bagian ini hilang.", confirm: "Kembalikan", danger: true }))) return;
    try {
      await api.del(`/api/platform/site/${tab}`);
      const fresh = await api.get<{ site: Site }>("/api/platform/site");
      setDraft({ ...draft, [tab]: fresh.site[tab] });
      await reload(true);
      toast("Dikembalikan ke isi bawaan.");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <>
      <PageHead
        title="Konten situs"
        sub="Menu atas, halaman solusi bisnis, testimoni, dan footer di pesan.in. Simpan per bagian."
        actions={<a className="btn" href="/" target="_blank" rel="noreferrer"><ExternalLink /> Lihat situs</a>}
      />
      <div className="stack" style={{ gap: 16 }}>
        <Segmented label="Bagian" value={tab} onChange={(v) => setTab(v)} options={TABS.map((t) => ({ ...t, label: <>{t.label}{JSON.stringify(draft[t.value]) !== JSON.stringify(data.site[t.value]) ? " •" : ""}</> }))} />
        {tab === "nav" && <NavEditor value={draft.nav} onChange={(v) => set("nav", v)} />}
        {tab === "solutions" && <SolutionsEditor value={draft.solutions} onChange={(v) => set("solutions", v)} />}
        {tab === "testimonials" && <TestimonialsEditor value={draft.testimonials} onChange={(v) => set("testimonials", v)} />}
        {tab === "footer" && <FooterEditor value={draft.footer} onChange={(v) => set("footer", v)} />}
        <div className="form-actions sc-actions">
          <button type="button" className="btn btn-ghost" onClick={reset}><RotateCcw /> Isi bawaan</button>
          {dirty && <button type="button" className="btn" onClick={() => setDraft({ ...draft, [tab]: structuredClone(data.site[tab]) })}>Batalkan perubahan</button>}
          <button type="button" className="btn btn-primary" disabled={!dirty || busy} onClick={save}>{busy ? "Menyimpan..." : "Simpan bagian ini"}</button>
        </div>
      </div>
    </>
  );
}

// ---------- Menu atas ----------
function NavEditor({ value, onChange }: { value: NavGroup[]; onChange: (v: NavGroup[]) => void }) {
  const upd = (i: number, g: NavGroup) => onChange(value.map((x, j) => (j === i ? g : x)));
  return (
    <section className="panel stack">
      <p className="small muted">Setiap menu bisa berupa tautan biasa, dropdown berisi tautan, atau dropdown solusi bisnis yang terisi otomatis dari tab Solusi bisnis. {HREF_HINT}</p>
      {value.map((g, i) => {
        const kind = g.auto ? "auto" : g.href !== undefined ? "link" : "drop";
        return (
          <div key={i} className="sc-block">
            <div className="sc-block-head">
              <input className="input" aria-label="Nama menu" value={g.label} maxLength={30} onChange={(e) => upd(i, { ...g, label: e.target.value })} />
              <select
                className="input"
                aria-label="Jenis menu"
                value={kind}
                onChange={(e) => {
                  const k = e.target.value;
                  upd(i, k === "link" ? { label: g.label, href: g.href ?? "/", sections: [] } : k === "auto" ? { label: g.label, auto: "solutions", sections: [] } : { label: g.label, sections: g.sections.length ? g.sections : [{ title: "", items: [] }] });
                }}
              >
                <option value="link">Tautan biasa</option>
                <option value="drop">Dropdown</option>
                <option value="auto">Dropdown solusi (otomatis)</option>
              </select>
              <RowTools i={i} n={value.length} label={g.label || "menu"} onMove={(d) => onChange(move(value, i, d))} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
            </div>
            {kind === "link" && (
              <Field label="Alamat" htmlFor={`nav-h-${i}`}>
                <input id={`nav-h-${i}`} className="input" value={g.href ?? ""} maxLength={300} onChange={(e) => upd(i, { ...g, href: e.target.value.trim() })} />
              </Field>
            )}
            {kind === "auto" && <p className="small muted">Berisi semua halaman solusi yang sudah terbit, urut seperti di tab Solusi bisnis.</p>}
            {kind === "drop" && (
              <div className="stack-sm">
                {g.sections.map((s, si) => (
                  <div key={si} className="sc-sec">
                    <div className="row" style={{ gap: 8 }}>
                      <input className="input" aria-label="Judul kolom" placeholder="Judul kolom (opsional)" value={s.title} maxLength={40} onChange={(e) => upd(i, { ...g, sections: g.sections.map((x, j) => (j === si ? { ...x, title: e.target.value } : x)) })} />
                      <button type="button" className="icon-btn" aria-label="Hapus kolom" onClick={() => upd(i, { ...g, sections: g.sections.filter((_, j) => j !== si) })}><Trash2 /></button>
                    </div>
                    <LinksEditor links={s.items} max={12} withDesc onChange={(items) => upd(i, { ...g, sections: g.sections.map((x, j) => (j === si ? { ...x, items } : x)) })} />
                  </div>
                ))}
                {g.sections.length < 3 && <button type="button" className="btn btn-sm" onClick={() => upd(i, { ...g, sections: [...g.sections, { title: "", items: [] }] })}><Plus /> Tambah kolom</button>}
              </div>
            )}
          </div>
        );
      })}
      {value.length < 7 && <button type="button" className="btn" onClick={() => onChange([...value, { label: "Menu baru", href: "/", sections: [] }])}><Plus /> Tambah menu</button>}
    </section>
  );
}

// ---------- Solusi bisnis ----------
const blankSolution = (): Solution => ({ slug: "", name: "", icon: "store", headline: "", intro: "", points: [], features: [], published: false });

function SolutionsEditor({ value, onChange }: { value: Solution[]; onChange: (v: Solution[]) => void }) {
  const [edit, setEdit] = useState<{ i: number; s: Solution } | null>(null);
  return (
    <section className="panel stack">
      <p className="small muted">Setiap jenis usaha punya halaman sendiri di <code>/solusi/&lt;alamat&gt;</code>, muncul di menu atas dan footer kalau sudah terbit.</p>
      {value.length === 0 ? (
        <Empty title="Belum ada halaman solusi" />
      ) : (
        value.map((s, i) => (
          <div key={s.slug || i} className="sc-row">
            <div style={{ minWidth: 0 }}>
              <div className="strong">{s.name || "(tanpa nama)"} {!s.published && <span className="badge">Draf</span>}</div>
              <div className="small muted">/solusi/{s.slug} · {s.features.length} fitur</div>
            </div>
            {s.published && <a className="icon-btn" href={`/solusi/${s.slug}`} target="_blank" rel="noreferrer" aria-label={`Buka halaman ${s.name}`}><ExternalLink /></a>}
            <button type="button" className="icon-btn" aria-label={`Ubah ${s.name}`} onClick={() => setEdit({ i, s: structuredClone(s) })}><Pencil /></button>
            <RowTools i={i} n={value.length} label={s.name} onMove={(d) => onChange(move(value, i, d))} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
          </div>
        ))
      )}
      {value.length < 12 && <button type="button" className="btn" onClick={() => setEdit({ i: -1, s: blankSolution() })}><Plus /> Tambah jenis usaha</button>}
      {edit && (
        <SolutionModal
          s={edit.s}
          taken={value.filter((_, j) => j !== edit.i).map((x) => x.slug)}
          onClose={() => setEdit(null)}
          onDone={(s) => {
            onChange(edit.i < 0 ? [...value, s] : value.map((x, j) => (j === edit.i ? s : x)));
            setEdit(null);
          }}
        />
      )}
    </section>
  );
}

const slugify = (v: string) => v.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

function SolutionModal({ s: init, taken, onClose, onDone }: { s: Solution; taken: string[]; onClose: () => void; onDone: (s: Solution) => void }) {
  const [s, setS] = useState(init);
  const [pts, setPts] = useState(init.points.join("\n"));
  const slugErr = !s.slug ? "Isi alamat halaman." : taken.includes(s.slug) ? "Alamat sudah dipakai." : null;
  const ok = !slugErr && s.name.trim().length >= 2 && s.headline.trim().length >= 5;
  const toggle = (k: FeatureKey) => setS({ ...s, features: s.features.includes(k) ? s.features.filter((x) => x !== k) : s.features.length >= 9 ? s.features : [...s.features, k] });
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={init.name ? `Ubah ${init.name}` : "Jenis usaha baru"}
      footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={!ok} onClick={() => onDone({ ...s, points: pts.split("\n").map((p) => p.trim()).filter(Boolean).slice(0, 6) })}>Pakai</button></>}
    >
      <div className="form-grid">
        <div className="form-row">
          <Field label="Nama jenis usaha" htmlFor="so-name">
            <input id="so-name" className="input" value={s.name} maxLength={40} onChange={(e) => setS({ ...s, name: e.target.value, slug: init.slug || !s.slug || s.slug === slugify(s.name) ? slugify(e.target.value) : s.slug })} />
          </Field>
          <Field label="Alamat halaman" htmlFor="so-slug" hint={`pesan.in/solusi/${s.slug || "..."}`} error={s.slug || s.name ? slugErr : null}>
            <input id="so-slug" className="input" value={s.slug} maxLength={40} onChange={(e) => setS({ ...s, slug: slugify(e.target.value) })} />
          </Field>
        </div>
        <div className="field">
          <span className="field-label">Ikon</span>
          <div className="row wrap">
            {SOLUTION_ICONS.map((ic) => (
              <button key={ic} type="button" className="chip" aria-pressed={s.icon === ic} onClick={() => setS({ ...s, icon: ic })}>{ICON_LABEL[ic]}</button>
            ))}
          </div>
        </div>
        <Field label="Judul besar" htmlFor="so-head" hint="Satu kalimat tentang hasil yang dirasakan pemilik usaha.">
          <input id="so-head" className="input" value={s.headline} maxLength={120} onChange={(e) => setS({ ...s, headline: e.target.value })} />
        </Field>
        <Field label="Paragraf pembuka" htmlFor="so-intro">
          <textarea id="so-intro" className="input" rows={3} value={s.intro} maxLength={400} onChange={(e) => setS({ ...s, intro: e.target.value })} />
        </Field>
        <Field label="Masalah yang dibereskan (satu per baris, maks. 6)" htmlFor="so-pts">
          <textarea id="so-pts" className="input" rows={5} value={pts} onChange={(e) => setPts(e.target.value)} />
        </Field>
        <div className="field">
          <span className="field-label">Fitur yang ditampilkan ({s.features.length}/9)</span>
          <div className="row wrap">
            {FEATURE_KEYS.map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={s.features.includes(k)} onClick={() => toggle(k)}>{FEATURES[k].title}</button>
            ))}
          </div>
        </div>
        <Switch checked={s.published} onChange={(v) => setS({ ...s, published: v })} label="Terbitkan" hint="Draf tidak muncul di situs." />
      </div>
    </Modal>
  );
}

// ---------- Testimoni ----------
const blankTestimonial = (): Testimonial => ({ id: Math.random().toString(36).slice(2, 10), quote: "", name: "", role: "Pemilik", business: "", city: "", photo_url: "", consent: false, published: false });

function TestimonialsEditor({ value, onChange }: { value: Testimonial[]; onChange: (v: Testimonial[]) => void }) {
  const [edit, setEdit] = useState<{ i: number; t: Testimonial } | null>(null);
  return (
    <section className="panel stack">
      <div className="banner warn">
        Isi hanya dengan testimoni asli dari pemilik usaha yang benar-benar memakai Pesan.in, dengan izin tertulis darinya (pesan WhatsApp atau email sudah cukup sebagai bukti). Testimoni karangan melanggar UU Perlindungan Konsumen. Bagian testimoni di landing baru muncul setelah ada yang terbit.
      </div>
      {value.length === 0 ? (
        <Empty title="Belum ada testimoni">Minta pelanggan pertama yang puas untuk menulis 1–3 kalimat tentang pengalamannya.</Empty>
      ) : (
        value.map((t, i) => (
          <div key={t.id} className="sc-row">
            <div style={{ minWidth: 0 }}>
              <div className="strong">{t.name} · {t.business} {!t.published && <span className="badge">Draf</span>}</div>
              <div className="small muted sc-quote">"{t.quote}"</div>
            </div>
            <button type="button" className="icon-btn" aria-label={`Ubah testimoni ${t.name}`} onClick={() => setEdit({ i, t: structuredClone(t) })}><Pencil /></button>
            <RowTools i={i} n={value.length} label={t.name} onMove={(d) => onChange(move(value, i, d))} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
          </div>
        ))
      )}
      {value.length < 24 && <button type="button" className="btn" onClick={() => setEdit({ i: -1, t: blankTestimonial() })}><Plus /> Tambah testimoni</button>}
      {edit && (
        <TestimonialModal
          t={edit.t}
          onClose={() => setEdit(null)}
          onDone={(t) => {
            onChange(edit.i < 0 ? [...value, t] : value.map((x, j) => (j === edit.i ? t : x)));
            setEdit(null);
          }}
        />
      )}
    </section>
  );
}

function TestimonialModal({ t: init, onClose, onDone }: { t: Testimonial; onClose: () => void; onDone: (t: Testimonial) => void }) {
  const [t, setT] = useState(init);
  const ok = t.quote.trim().length >= 10 && t.name.trim().length >= 2 && t.business.trim().length >= 2 && /^(|https:\/\/\S+)$/.test(t.photo_url);
  return (
    <Modal
      open
      onClose={onClose}
      title={init.name ? `Ubah testimoni ${init.name}` : "Testimoni baru"}
      footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={!ok} onClick={() => onDone({ ...t, published: t.published && t.consent })}>Pakai</button></>}
    >
      <div className="form-grid">
        <Field label="Kutipan" htmlFor="ts-q" hint="Tulis persis seperti yang disampaikan. Boleh dirapikan ejaannya, bukan isinya.">
          <textarea id="ts-q" className="input" rows={4} value={t.quote} maxLength={400} onChange={(e) => setT({ ...t, quote: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label="Nama" htmlFor="ts-n"><input id="ts-n" className="input" value={t.name} maxLength={60} onChange={(e) => setT({ ...t, name: e.target.value })} /></Field>
          <Field label="Peran" htmlFor="ts-r"><input id="ts-r" className="input" value={t.role} maxLength={40} placeholder="Pemilik" onChange={(e) => setT({ ...t, role: e.target.value })} /></Field>
        </div>
        <div className="form-row">
          <Field label="Nama usaha" htmlFor="ts-b"><input id="ts-b" className="input" value={t.business} maxLength={60} onChange={(e) => setT({ ...t, business: e.target.value })} /></Field>
          <Field label="Kota" htmlFor="ts-c"><input id="ts-c" className="input" value={t.city} maxLength={40} onChange={(e) => setT({ ...t, city: e.target.value })} /></Field>
        </div>
        <Field label="Tautan foto (opsional)" htmlFor="ts-p" hint="Tautan https ke foto orangnya atau logo usahanya. Kosongkan untuk memakai inisial.">
          <input id="ts-p" className="input" inputMode="url" value={t.photo_url} maxLength={300} onChange={(e) => setT({ ...t, photo_url: e.target.value.trim() })} />
        </Field>
        <label className="sc-consent">
          <input type="checkbox" checked={t.consent} onChange={(e) => setT({ ...t, consent: e.target.checked, published: e.target.checked && t.published })} />
          <span>Saya punya izin tertulis dari orang ini untuk menampilkan nama, usaha, dan kutipannya di situs Pesan.in.</span>
        </label>
        <Switch checked={t.published && t.consent} disabled={!t.consent} onChange={(v) => setT({ ...t, published: v })} label="Terbitkan" hint={t.consent ? undefined : "Centang izin tertulis dulu."} />
      </div>
    </Modal>
  );
}

// ---------- Footer ----------
function FooterEditor({ value, onChange }: { value: SiteFooter; onChange: (v: SiteFooter) => void }) {
  const c = value.contact;
  const setCol = (i: number, col: FooterColumn) => onChange({ ...value, columns: value.columns.map((x, j) => (j === i ? col : x)) });
  return (
    <div className="stack">
      <section className="panel stack">
        <h2 className="sc-h">Tentang & kontak</h2>
        <Field label="Kalimat singkat di bawah logo" htmlFor="ft-tag">
          <textarea id="ft-tag" className="input" rows={2} value={value.tagline} maxLength={200} onChange={(e) => onChange({ ...value, tagline: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label="WhatsApp" htmlFor="ft-wa" hint="Kosongkan kalau belum ada."><input id="ft-wa" className="input" inputMode="tel" value={c.whatsapp} maxLength={20} placeholder="0812 3456 7890" onChange={(e) => onChange({ ...value, contact: { ...c, whatsapp: e.target.value } })} /></Field>
          <Field label="Email" htmlFor="ft-em"><input id="ft-em" className="input" type="email" value={c.email} maxLength={120} onChange={(e) => onChange({ ...value, contact: { ...c, email: e.target.value.trim() } })} /></Field>
        </div>
        <div className="form-row">
          <Field label="Jam layanan" htmlFor="ft-hr"><input id="ft-hr" className="input" value={c.hours} maxLength={80} placeholder="Senin–Sabtu, 09.00–17.00 WIB" onChange={(e) => onChange({ ...value, contact: { ...c, hours: e.target.value } })} /></Field>
          <Field label="Alamat" htmlFor="ft-ad"><input id="ft-ad" className="input" value={c.address} maxLength={200} onChange={(e) => onChange({ ...value, contact: { ...c, address: e.target.value } })} /></Field>
        </div>
      </section>
      <section className="panel stack">
        <h2 className="sc-h">Kolom tautan</h2>
        <p className="small muted">{HREF_HINT}</p>
        {value.columns.map((col, i) => (
          <div key={i} className="sc-block">
            <div className="sc-block-head">
              <input className="input" aria-label="Judul kolom" value={col.title} maxLength={40} onChange={(e) => setCol(i, { ...col, title: e.target.value })} />
              <select className="input" aria-label="Isi kolom" value={col.auto ? "auto" : "links"} onChange={(e) => setCol(i, e.target.value === "auto" ? { title: col.title, auto: "solutions", links: [] } : { title: col.title, links: col.links })}>
                <option value="links">Tautan pilihan</option>
                <option value="auto">Solusi bisnis (otomatis)</option>
              </select>
              <RowTools i={i} n={value.columns.length} label={col.title} onMove={(d) => onChange({ ...value, columns: move(value.columns, i, d) })} onRemove={() => onChange({ ...value, columns: value.columns.filter((_, j) => j !== i) })} />
            </div>
            {col.auto ? <p className="small muted">Berisi halaman solusi yang sudah terbit.</p> : <LinksEditor links={col.links} onChange={(links) => setCol(i, { ...col, links })} />}
          </div>
        ))}
        {value.columns.length < 4 && <button type="button" className="btn" onClick={() => onChange({ ...value, columns: [...value.columns, { title: "Kolom baru", links: [] }] })}><Plus /> Tambah kolom</button>}
      </section>
    </div>
  );
}

