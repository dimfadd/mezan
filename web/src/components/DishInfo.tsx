import { AlertTriangle, Check, Clock3, Flame, Users } from "lucide-react";

export function Chilis({ level }: { level: number }) {
  return (
    <span className="chilis" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Flame key={n} className={n <= level ? "" : "off"} fill={n <= level ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

const SPICE_WORD = ["Tidak pedas", "Sedikit pedas", "Pedas ringan", "Pedas", "Pedas sekali", "Sangat pedas"];

export interface DishDetails {
  portion: string;
  components: string;
  spice_level: number | null;
  prep_minutes: number | null;
  allergens: string;
}

/** Info yang membentuk ekspektasi pembeli: porsi, waktu saji, level pedas, isi, alergen. */
export function DishFacts({ d }: { d: DishDetails }) {
  const comps = d.components.split("\n").map((x) => x.trim()).filter(Boolean);
  const hasFacts = d.portion || d.prep_minutes || d.spice_level !== null;
  if (!hasFacts && comps.length === 0 && !d.allergens) return null;
  return (
    <div className="stack">
      {hasFacts && (
        <div className="dish-facts">
          {d.portion && (
            <span className="fact">
              <Users aria-hidden="true" /> {d.portion}
            </span>
          )}
          {d.prep_minutes ? (
            <span className="fact">
              <Clock3 aria-hidden="true" /> ±{d.prep_minutes} menit
            </span>
          ) : null}
          {d.spice_level !== null && (
            <span className="fact" aria-label={`${SPICE_WORD[d.spice_level]}, level ${d.spice_level} dari 5`}>
              {d.spice_level > 0 && <Chilis level={d.spice_level} />} {SPICE_WORD[d.spice_level]}
            </span>
          )}
        </div>
      )}
      {comps.length > 0 && (
        <div>
          <div className="small strong" style={{ marginBottom: 6 }}>Yang kamu dapat</div>
          <ul className="components">
            {comps.map((c) => (
              <li key={c}>
                <Check aria-hidden="true" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.allergens && (
        <p className="allergen">
          <AlertTriangle aria-hidden="true" /> {d.allergens}
        </p>
      )}
    </div>
  );
}
