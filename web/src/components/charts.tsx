import { useEffect, useRef, useState, type ReactNode } from "react";

// Grafik batang satu seri: satu warna (brand), tanpa legenda karena judul panel sudah menamai datanya.
// Setiap batang punya area hover/fokus yang lebih lebar dari batangnya + tooltip.
export interface BarDatum {
  key: string;
  value: number;
  label: string; // label sumbu
  tip: ReactNode; // isi tooltip
  highlight?: boolean;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}

export function BarChart({
  data,
  height = 220,
  formatAxis,
  labelEvery = 1,
  ariaLabel,
}: {
  data: BarDatum[];
  height?: number;
  formatAxis: (v: number) => string;
  labelEvery?: number;
  ariaLabel: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const left = 44;
  const bottom = 24;
  const top = 8;
  const plotW = width - left;
  const plotH = height - bottom - top;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const slot = plotW / Math.max(data.length, 1);
  const barW = Math.max(3, Math.min(36, slot * 0.62));
  const every = Math.max(labelEvery, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 44))));

  return (
    <div className="chart" ref={wrap} onMouseLeave={() => setActive(null)}>
      <svg height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => {
          const y = top + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line className="grid-line" x1={left} x2={width} y1={y} y2={y} />
              <text className="axis-label" x={left - 8} y={y + 4} textAnchor="end">
                {formatAxis(t)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.value / max) * plotH;
          const x = left + i * slot + (slot - barW) / 2;
          const y = top + plotH - h;
          // ujung atas membulat 4px, menempel di garis dasar
          const r = Math.min(4, h / 2, barW / 2);
          const path =
            h <= 0
              ? ""
              : `M${x},${top + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${top + plotH} Z`;
          return (
            <g key={d.key}>
              {path && <path d={path} className={`bar${active !== null && active !== i ? " dim" : ""}${d.highlight ? " hot" : ""}`} />}
              {i % every === 0 && (
                <text className="axis-label" x={x + barW / 2} y={height - 6} textAnchor="middle">
                  {d.label}
                </text>
              )}
              <rect
                className="hit"
                x={left + i * slot}
                y={top}
                width={slot}
                height={plotH}
                tabIndex={0}
                aria-label={`${d.label}: ${formatAxis(d.value)}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            </g>
          );
        })}
      </svg>
      {active !== null && data[active] && (
        <div
          className="chart-tip"
          style={{
            left: Math.min(Math.max(left + active * slot + slot / 2, 70), width - 70),
            top: top + plotH - (data[active].value / max) * plotH,
          }}
        >
          {data[active].tip}
        </div>
      )}
    </div>
  );
}

export function HBars({ rows, format }: { rows: { key: string; name: string; value: number; extra?: ReactNode }[]; format: (v: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar" key={r.key}>
          <span className="name">{r.name}</span>
          <span className="num small strong">
            {format(r.value)}
            {r.extra && <span className="muted"> {r.extra}</span>}
          </span>
          <div className="track" aria-hidden="true">
            <div className="fill" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
