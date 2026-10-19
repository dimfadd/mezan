import { Field } from "../../components/ui";
import { fmtMin } from "../../../../shared/schedule";

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const toHHMM = (m: number | null) => (m == null ? "" : fmtMin(m).replace(".", ":"));
const fromHHMM = (v: string) => {
  const [h, mi] = v.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(mi) ? h * 60 + mi : null;
};

/** Pilihan hari + jam mulai/selesai. Jam selesai lebih kecil dari jam mulai = lewat tengah malam. */
export function ScheduleFields({ days, from, to, onChange, allowAllDay }: { days: number; from: number | null; to: number | null; onChange: (v: { days: number; from: number | null; to: number | null }) => void; allowAllDay?: boolean }) {
  const allDay = from == null;
  return (
    <div className="stack-sm">
      <div className="row wrap" role="group" aria-label="Hari">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const on = ((days >> d) & 1) === 1;
          return (
            <button key={d} type="button" className="chip day-chip" aria-pressed={on} onClick={() => onChange({ days: on ? days & ~(1 << d) : days | (1 << d), from, to })}>
              {DAY_NAMES[d]}
            </button>
          );
        })}
      </div>
      {days === 0 && <span className="err small" style={{ color: "var(--danger)" }}>Pilih minimal satu hari.</span>}
      <div className="row wrap" style={{ alignItems: "flex-end" }}>
        {allowAllDay && (
          <label className="row small" style={{ gap: 6 }}>
            <input type="checkbox" checked={allDay} onChange={(e) => onChange({ days, from: e.target.checked ? null : 360, to: e.target.checked ? null : 600 })} /> Sepanjang hari
          </label>
        )}
        {!allDay && (
          <>
            <Field label="Mulai" htmlFor="sc-from">
              <input id="sc-from" type="time" className="input" style={{ width: 130 }} value={toHHMM(from)} onChange={(e) => onChange({ days, from: fromHHMM(e.target.value), to })} />
            </Field>
            <Field label="Selesai" htmlFor="sc-to">
              <input id="sc-to" type="time" className="input" style={{ width: 130 }} value={toHHMM(to)} onChange={(e) => onChange({ days, from, to: fromHHMM(e.target.value) })} />
            </Field>
          </>
        )}
      </div>
      {!allDay && from != null && to != null && to < from && <span className="hint">Lewat tengah malam: berlaku sampai {fmtMin(to)} hari berikutnya.</span>}
    </div>
  );
}

