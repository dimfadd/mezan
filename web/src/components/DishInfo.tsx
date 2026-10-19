import { AlertTriangle, Check, Clock3, Flame, Users } from "lucide-react";
import { DICT, loc, type Lang } from "../../../shared/i18n";

export function Chilis({ level }: { level: number }) {
  return (
    <span className="chilis" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Flame key={n} className={n <= level ? "" : "off"} fill={n <= level ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

export interface DishDetails {
  portion: string;
  components: string;
  spice_level: number | null;
  prep_minutes: number | null;
  allergens: string;
  portion_en?: string;
  components_en?: string;
  allergens_en?: string;
}

/** Info yang membentuk ekspektasi pembeli: porsi, waktu saji, level pedas, isi, alergen. */
export function DishFacts({ d, lang = "id" }: { d: DishDetails; lang?: Lang }) {
  const t = DICT[lang];
  const portion = loc(lang, d.portion, d.portion_en);
  const allergens = loc(lang, d.allergens, d.allergens_en);
  const comps = loc(lang, d.components, d.components_en).split("\n").map((x) => x.trim()).filter(Boolean);
  const hasFacts = portion || d.prep_minutes || d.spice_level !== null;
  if (!hasFacts && comps.length === 0 && !allergens) return null;
  return (
    <div className="stack">
      {hasFacts && (
        <div className="dish-facts">
          {portion && (
            <span className="fact">
              <Users aria-hidden="true" /> {portion}
            </span>
          )}
          {d.prep_minutes ? (
            <span className="fact">
              <Clock3 aria-hidden="true" /> {t.minutes(d.prep_minutes)}
            </span>
          ) : null}
          {d.spice_level !== null && (
            <span className="fact" aria-label={t.spiceAria(t.spice[d.spice_level], d.spice_level)}>
              {d.spice_level > 0 && <Chilis level={d.spice_level} />} {t.spice[d.spice_level]}
            </span>
          )}
        </div>
      )}
      {comps.length > 0 && (
        <div>
          <div className="small strong" style={{ marginBottom: 6 }}>{t.whatYouGet}</div>
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
      {allergens && (
        <p className="allergen">
          <AlertTriangle aria-hidden="true" /> {allergens}
        </p>
      )}
    </div>
  );
}
