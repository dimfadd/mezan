// Ilustrasi sederhana untuk simulasi di landing page.
// Sengaja digambar datar (bukan foto stok) supaya jelas ini peraga, bukan klaim foto toko sungguhan.

export type FoodKind = "geprek" | "nasgor" | "soto" | "jeruk" | "kopi" | "teh" | "esteh" | "pisang" | "kerupuk" | "air";

export function Food({ kind, view = 0 }: { kind: FoodKind; view?: 0 | 1 }) {
  // view 1 = sudut dekat, dipakai sebagai "foto kedua" di galeri.
  const zoom = view === 1 ? "translate(-30 -22) scale(1.6)" : undefined;
  return (
    <svg viewBox="0 0 100 100" className="lp-food" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="100" height="100" fill={BG[kind]} />
      <g transform={zoom}>{ART[kind]}</g>
    </svg>
  );
}

const BG: Record<FoodKind, string> = {
  geprek: "#e6d5bb",
  nasgor: "#d9c7a8",
  soto: "#cfd8c4",
  jeruk: "#f1dfc0",
  kopi: "#dccab3",
  teh: "#e5d3bd",
  esteh: "#e9dcc4",
  pisang: "#ead9bf",
  kerupuk: "#e9dfcf",
  air: "#d6e2e4",
};

const plate = (
  <>
    <circle cx="50" cy="52" r="40" fill="#f6f2ea" />
    <circle cx="50" cy="52" r="33" fill="#fffdf9" />
  </>
);

const ART: Record<FoodKind, React.ReactNode> = {
  geprek: (
    <>
      {plate}
      <ellipse cx="34" cy="60" rx="15" ry="12" fill="#fbfaf5" stroke="#e7e0d2" />
      <path d="M46 34c10-7 25-4 27 8 2 12-6 22-18 22-11 0-18-8-17-17 0-5 3-10 8-13z" fill="#d49a4c" />
      <path d="M49 37l4 5M58 35l2 6M66 40l-3 5M52 58l3-5M64 56l-2-5M45 47l5 1" stroke="#a8692a" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M51 44c4-4 10-5 14-2 3 3 1 6-3 7-3 1-4 4-8 4-4 0-6-3-5-5 0-2 1-3 2-4z" fill="#b8321c" opacity="0.92" />
      <path d="M53 47c2-1 4-1 5 0M58 50c2 0 3-1 4-2" stroke="#e46a3c" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="30" cy="38" rx="9" ry="4" transform="rotate(-30 30 38)" fill="#5b8d3b" />
      <ellipse cx="25" cy="44" rx="8" ry="3.4" transform="rotate(10 25 44)" fill="#6f9f45" />
      <circle cx="64" cy="70" r="5" fill="#d3e6ac" stroke="#6e9b45" strokeWidth="1.4" />
      <circle cx="56" cy="74" r="4.5" fill="#d3e6ac" stroke="#6e9b45" strokeWidth="1.4" />
    </>
  ),
  nasgor: (
    <>
      {plate}
      <path d="M24 56c0-13 12-22 26-22s27 9 27 22c0 9-12 15-27 15S24 65 24 56z" fill="#c4813f" />
      {[[34, 50], [44, 45], [58, 47], [63, 56], [40, 60], [52, 62], [30, 58]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.5" fill={i % 2 ? "#8a5226" : "#e2b06f"} />
      ))}
      <path d="M44 40c6-6 17-5 20 2 3 7-3 12-10 12-9 0-14-7-10-14z" fill="#fffaf0" />
      <circle cx="53" cy="45" r="5" fill="#f0b02a" />
      <path d="M18 70c6-8 16-8 20 0-6 5-14 5-20 0z" fill="#f2dcb1" />
    </>
  ),
  soto: (
    <>
      <circle cx="50" cy="52" r="38" fill="#f2efe8" />
      <circle cx="50" cy="52" r="31" fill="#e7b73d" />
      {[[40, 46], [56, 42], [48, 58], [60, 56], [36, 58]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="9" height="2.6" rx="1.3" transform={`rotate(${i * 37} ${x} ${y})`} fill="#f5e6c8" />
      ))}
      <ellipse cx="58" cy="50" rx="8" ry="6" fill="#fffaf0" />
      <circle cx="58" cy="50" r="3.6" fill="#f0a92a" />
      <circle cx="42" cy="38" r="2" fill="#6f9f45" />
      <circle cx="46" cy="36" r="1.6" fill="#6f9f45" />
    </>
  ),
  jeruk: (
    <>
      <path d="M34 26h32l-4 58H38z" fill="#fbf6ec" opacity="0.7" />
      <path d="M35.5 40h29l-3 42h-23z" fill="#f29b2c" />
      <rect x="40" y="44" width="8" height="8" rx="1.5" fill="#fff" opacity="0.55" />
      <rect x="51" y="50" width="8" height="8" rx="1.5" fill="#fff" opacity="0.45" />
      <path d="M58 18l-6 30" stroke="#2f6d57" strokeWidth="3" strokeLinecap="round" />
      <circle cx="66" cy="30" r="8" fill="#f6b23c" stroke="#e08a1c" strokeWidth="1.5" />
    </>
  ),
  kopi: (
    <>
      <path d="M34 26h32l-4 58H38z" fill="#fbf6ec" opacity="0.7" />
      <path d="M35.5 38h29l-1 14h-27z" fill="#efe1c9" />
      <path d="M36.5 52h27l-1.5 30h-24z" fill="#7a4a2a" />
      <path d="M37 52c8 4 18-4 26 0" stroke="#b07a4c" strokeWidth="3" fill="none" />
      <rect x="42" y="40" width="7" height="7" rx="1.5" fill="#fff" opacity="0.6" />
    </>
  ),
  teh: (
    <>
      <path d="M34 30h32l-4 54H38z" fill="#fbf6ec" opacity="0.7" />
      <path d="M35 36h30l-3.5 46h-23z" fill="#c78d55" />
      <path d="M35 36h30l-0.6 8h-28.8z" fill="#f3e3c8" />
    </>
  ),
  esteh: (
    <>
      <path d="M34 26h32l-4 58H38z" fill="#fbf6ec" opacity="0.7" />
      <path d="M35.5 40h29l-3 42h-23z" fill="#a8541f" />
      <rect x="41" y="46" width="8" height="8" rx="1.5" fill="#fff" opacity="0.5" />
      <rect x="52" y="54" width="8" height="8" rx="1.5" fill="#fff" opacity="0.4" />
    </>
  ),
  pisang: (
    <>
      {plate}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={26 + i * 10} y={38 + (i % 2) * 6} width="9" height="26" rx="4.5" fill="#d9a046" />
      ))}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={28 + i * 7} y={44 + (i % 3) * 5} width="6" height="1.8" rx="0.9" fill="#f7e27a" />
      ))}
    </>
  ),
  kerupuk: (
    <>
      <rect x="24" y="22" width="52" height="60" rx="6" fill="#f6eedf" stroke="#d8c8ac" />
      <circle cx="44" cy="46" r="11" fill="#f2d3b0" />
      <circle cx="58" cy="58" r="10" fill="#efc9a2" />
      <rect x="24" y="22" width="52" height="10" rx="5" fill="#c23a22" />
    </>
  ),
  air: (
    <>
      <rect x="40" y="20" width="20" height="8" rx="2" fill="#2d6fb3" />
      <path d="M38 30h24v52a4 4 0 0 1-4 4H42a4 4 0 0 1-4-4z" fill="#eaf4f7" stroke="#9fc3cf" />
      <rect x="38" y="48" width="24" height="14" fill="#2d6fb3" />
    </>
  ),
};

/** Pola kotak mirip QR. Hanya hiasan, tidak bisa dipindai. */
export function FakeQR({ size = 120 }: { size?: number }) {
  const n = 21;
  const cells: [number, number][] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const finder = (x: number, y: number) => x < 8 && y < 8;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (finder(x, y) || finder(n - 1 - x, y) || finder(x, n - 1 - y)) continue;
      if (rnd() > 0.52) cells.push([x, y]);
    }
  const F = ({ x, y }: { x: number; y: number }) => (
    <>
      <rect x={x} y={y} width="7" height="7" fill="currentColor" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="currentColor" />
    </>
  );
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} width={size} height={size} aria-hidden="true" shapeRendering="crispEdges">
      <rect x="-1" y="-1" width={n + 2} height={n + 2} fill="#fff" />
      <F x={0} y={0} />
      <F x={n - 7} y={0} />
      <F x={0} y={n - 7} />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
    </svg>
  );
}
