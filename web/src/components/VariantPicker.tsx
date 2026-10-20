import { useMemo, useState } from "react";
import { variantLabel } from "../../../shared/variants";

export interface PickVariant {
  id: string;
  opt1: string;
  opt2: string;
  sold_out: boolean;
}

/**
 * Pilih varian dengan dua baris tombol (mis. Warna lalu Ukuran). Kombinasi yang tidak ada atau habis
 * dinonaktifkan, jadi pembeli/kasir tidak bisa memilih yang tidak bisa dijual.
 */
export function VariantPicker<V extends PickVariant>({
  opt1Name,
  opt2Name,
  variants,
  value,
  onChange,
  soldOutLabel = "habis",
  priceOf,
}: {
  opt1Name: string;
  opt2Name: string;
  variants: V[];
  value: V | null;
  onChange: (v: V | null) => void;
  soldOutLabel?: string;
  priceOf?: (v: V) => string;
}) {
  const ones = useMemo(() => [...new Set(variants.map((v) => v.opt1))], [variants]);
  const twos = useMemo(() => [...new Set(variants.map((v) => v.opt2).filter(Boolean))], [variants]);
  const [o1, setO1] = useState<string | null>(value?.opt1 ?? (ones.length === 1 ? ones[0] : null));
  const find = (a: string | null, b: string | null) => variants.find((v) => v.opt1 === a && (twos.length ? v.opt2 === b : true)) ?? null;
  const pick1 = (a: string) => {
    setO1(a);
    const keep = value && value.opt1 === a ? value : null;
    const auto = !twos.length ? find(a, null) : keep ?? (twos.length === 1 ? find(a, twos[0]) : null);
    onChange(auto && !auto.sold_out ? auto : null);
  };
  const pick2 = (b: string) => {
    const v = find(o1, b);
    onChange(v && !v.sold_out ? v : null);
  };
  const allOut1 = (a: string) => variants.filter((v) => v.opt1 === a).every((v) => v.sold_out);
  return (
    <div className="vp">
      <div className="vp-row" role="group" aria-label={opt1Name}>
        <span className="vp-h">{opt1Name}</span>
        <div className="vp-opts">
          {ones.map((a) => (
            <button key={a} type="button" className="vp-opt" aria-pressed={o1 === a} disabled={allOut1(a)} onClick={() => pick1(a)}>
              {a}
              {allOut1(a) && <small> · {soldOutLabel}</small>}
            </button>
          ))}
        </div>
      </div>
      {twos.length > 0 && (
        <div className="vp-row" role="group" aria-label={opt2Name}>
          <span className="vp-h">{opt2Name}</span>
          <div className="vp-opts">
            {twos.map((b) => {
              const v = o1 ? find(o1, b) : null;
              const off = !o1 || !v || v.sold_out;
              return (
                <button key={b} type="button" className="vp-opt" aria-pressed={!!value && value.opt1 === o1 && value.opt2 === b} disabled={off} onClick={() => pick2(b)}>
                  {b}
                  {o1 && v?.sold_out && <small> · {soldOutLabel}</small>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {value && priceOf && (
        <p className="vp-sel small">
          {variantLabel(value)} · <b className="money">{priceOf(value)}</b>
        </p>
      )}
    </div>
  );
}
