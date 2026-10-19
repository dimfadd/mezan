import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Empty, Field, Loading, Modal, Switch, useConfirm, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { ALL_DAYS, daysText, discounted, fmtMin, type PriceRule } from "../../../../shared/schedule";
import { rupiah } from "../../lib/format";
import { ScheduleFields } from "./ScheduleFields";
import type { Category } from "./types";

type Draft = { id?: string; name: string; percent: number | ""; days: number; start_min: number | null; end_min: number | null; category_ids: string[]; active: boolean };
const blank: Draft = { name: "Happy hour", percent: 20, days: ALL_DAYS, start_min: 900, end_min: 1020, category_ids: [], active: true };

/** Promo jam tertentu: diskon persen otomatis untuk kategori pilihan pada jam & hari tertentu. */
export function PriceRules({ open, categories, onClose }: { open: boolean; categories: Category[]; onClose: () => void }) {
  const { data, loading, reload } = useApi<{ rules: PriceRule[] }>(open ? "/api/store/price-rules" : null);
  const toast = useToast();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  const save = async () => {
    if (!draft) return;
    if (draft.start_min == null || draft.end_min == null) return toast("Isi jam mulai dan selesai.", "error");
    setBusy(true);
    try {
      const body = { ...draft, percent: Number(draft.percent) || 0 };
      if (draft.id) await api.put(`/api/store/price-rules/${draft.id}`, body);
      else await api.post("/api/store/price-rules", body);
      toast("Promo disimpan. Harga di menu QR dan kasir berubah otomatis sesuai jamnya.");
      setDraft(null);
      reload(true);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (r: PriceRule) => {
    try {
      await api.put(`/api/store/price-rules/${r.id}`, { ...r, category_ids: r.category_ids ? r.category_ids.split(",") : [], active: !r.active });
      reload(true);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const remove = async (r: PriceRule) => {
    if (!(await confirm({ title: `Hapus promo ${r.name}?`, confirm: "Hapus promo", danger: true }))) return;
    try {
      await api.del(`/api/store/price-rules/${r.id}`);
      reload(true);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { setDraft(null); onClose(); }}
      title={draft ? (draft.id ? "Ubah promo" : "Promo baru") : "Promo jam tertentu"}
      wide
      footer={
        draft ? (
          <>
            <button className="btn" onClick={() => setDraft(null)}>Kembali</button>
            <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Menyimpan..." : "Simpan promo"}</button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={() => setDraft({ ...blank })}><Plus /> Promo baru</button>
        )
      }
    >
      {draft ? (
        <div className="form-grid">
          <div className="form-row">
            <Field label="Nama promo" htmlFor="pr-name" hint="Tampil di samping harga, mis. Happy hour.">
              <input id="pr-name" className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={40} />
            </Field>
            <Field label="Diskon (%)" htmlFor="pr-pct" hint={draft.percent ? `Contoh: ${rupiah(15000)} jadi ${rupiah(discounted(15000, Number(draft.percent)))}` : undefined}>
              <input id="pr-pct" className="input num" inputMode="numeric" value={draft.percent} onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 2); setDraft({ ...draft, percent: d === "" ? "" : Number(d) }); }} />
            </Field>
          </div>
          <div className="field">
            <span className="field-label">Hari & jam</span>
            <ScheduleFields days={draft.days} from={draft.start_min} to={draft.end_min} onChange={(v) => setDraft({ ...draft, days: v.days, start_min: v.from, end_min: v.to })} />
          </div>
          <div className="field">
            <span className="field-label">Berlaku untuk</span>
            <div className="row wrap">
              <button type="button" className="chip" aria-pressed={draft.category_ids.length === 0} onClick={() => setDraft({ ...draft, category_ids: [] })}>Semua menu</button>
              {categories.map((c) => {
                const on = draft.category_ids.includes(c.id);
                return (
                  <button key={c.id} type="button" className="chip" aria-pressed={on} onClick={() => setDraft({ ...draft, category_ids: on ? draft.category_ids.filter((x) => x !== c.id) : [...draft.category_ids, c.id] })}>
                    {c.name}
                  </button>
                );
              })}
            </div>
            <span className="hint">Kalau beberapa promo berlaku bersamaan, yang dipakai diskon terbesar (tidak ditumpuk).</span>
          </div>
          <Switch checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label="Aktif" />
        </div>
      ) : loading || !data ? (
        <Loading rows={2} height={50} />
      ) : data.rules.length === 0 ? (
        <Empty title="Belum ada promo">Contoh: minuman diskon 20% setiap hari jam 15.00 sampai 17.00, saat kafe sepi. Harga berubah otomatis di menu QR dan kasir.</Empty>
      ) : (
        <div className="stack-sm">
          {data.rules.map((r) => (
            <div key={r.id} className="rule-row">
              <div style={{ minWidth: 0 }}>
                <div className="strong">{r.name} · −{r.percent}%</div>
                <div className="small muted">
                  {[daysText(r.days) || "Setiap hari", `${fmtMin(r.start_min)}–${fmtMin(r.end_min)}`].join(" · ")} ·{" "}
                  {r.category_ids ? r.category_ids.split(",").map((id) => catName.get(id) ?? "?").join(", ") : "Semua menu"}
                </div>
              </div>
              <Switch checked={!!r.active} onChange={() => toggle(r)} label={<span className="small">{r.active ? "Aktif" : "Mati"}</span>} />
              <button className="icon-btn" aria-label={`Ubah ${r.name}`} onClick={() => setDraft({ id: r.id, name: r.name, percent: r.percent, days: r.days, start_min: r.start_min, end_min: r.end_min, category_ids: r.category_ids ? r.category_ids.split(",") : [], active: !!r.active })}><Pencil /></button>
              <button className="icon-btn" aria-label={`Hapus ${r.name}`} onClick={() => remove(r)}><Trash2 /></button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
