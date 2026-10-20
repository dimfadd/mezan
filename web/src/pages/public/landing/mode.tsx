import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChefHat, ShoppingBag, Smartphone, Store, UserRound, UtensilsCrossed } from "lucide-react";

/**
 * Isi landing dipilah dua tingkat supaya tidak kepanjangan dan tidak campur aduk:
 * 1. Jenis usaha: makanan & minuman, atau toko barang.
 * 2. Sudut pandang: depan (yang dilihat pembeli / kasir) atau belakang (yang dipakai pemilik).
 */
export type Mode = "kuliner" | "toko";
export type Sub = "depan" | "belakang";

const KEY = "lp-mode";
// Bagian milik satu mode & sudut pandang. Tautan ke sana (menu atas, footer, halaman solusi) memindah pilihannya.
const ONLY: Record<string, { mode?: Mode; sub: Sub }> = {
  simulasi: { mode: "kuliner", sub: "depan" },
  antrean: { mode: "kuliner", sub: "depan" },
  pembeli: { mode: "kuliner", sub: "depan" },
  tampilan: { mode: "kuliner", sub: "depan" },
  kasir: { mode: "kuliner", sub: "belakang" },
  untung: { mode: "kuliner", sub: "belakang" },
  fitur: { mode: "kuliner", sub: "belakang" },
  "simulasi-toko": { mode: "toko", sub: "depan" },
  "fitur-kasir": { mode: "toko", sub: "depan" },
  "pemilik-toko": { mode: "toko", sub: "belakang" },
  "fitur-toko": { mode: "toko", sub: "belakang" },
  // Ada di kedua jenis usaha, selalu di sisi pemilik.
  mudah: { sub: "belakang" },
  pantau: { sub: "belakang" },
};

const fromHash = () => ONLY[decodeURIComponent(window.location.hash.slice(1))];

const initial = (): { mode: Mode; sub: Sub } => {
  const q = new URLSearchParams(window.location.search);
  const h = fromHash();
  let mode: Mode | null = h?.mode ?? null;
  if (!mode) {
    const u = q.get("untuk");
    if (u === "toko" || u === "kuliner") mode = u;
  }
  if (!mode) {
    try {
      const v = localStorage.getItem(KEY);
      if (v === "toko" || v === "kuliner") mode = v;
    } catch {
      /* penyimpanan diblokir: pakai bawaan */
    }
  }
  const l = q.get("lihat");
  const sub: Sub = h?.sub ?? (l === "pemilik" ? "belakang" : "depan");
  return { mode: mode ?? "kuliner", sub };
};

export function useLandingMode() {
  const [state, setState] = useState(initial);

  const writeUrl = (s: { mode: Mode; sub: Sub }) => {
    const url = new URL(window.location.href);
    url.searchParams.set("untuk", s.mode);
    if (s.sub === "belakang") url.searchParams.set("lihat", "pemilik");
    else url.searchParams.delete("lihat");
    url.hash = "";
    window.history.replaceState(window.history.state, "", url);
  };

  const setMode = useCallback((mode: Mode) => {
    // Ganti jenis usaha selalu mulai dari sisi depan: yang paling mudah dibayangkan dulu.
    const next = { mode, sub: "depan" as Sub };
    setState(next);
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* mode browser privat */
    }
    writeUrl(next);
  }, []);

  const setSub = useCallback((sub: Sub) => {
    setState((s) => {
      const next = { ...s, sub };
      writeUrl(next);
      return next;
    });
  }, []);

  // Klik tautan #bagian milik pilihan lain: pindah dulu, lalu useScrollToHash menggulir ke sana.
  useEffect(() => {
    const on = () => {
      const h = fromHash();
      if (h) setState((s) => ({ mode: h.mode ?? s.mode, sub: h.sub }));
    };
    window.addEventListener("hashchange", on);
    window.addEventListener("popstate", on);
    return () => {
      window.removeEventListener("hashchange", on);
      window.removeEventListener("popstate", on);
    };
  }, []);

  return { ...state, setMode, setSub };
}

export interface SlideOption<T extends string> {
  value: T;
  label: string;
  short?: string;
  sub?: string;
  icon: ReactNode;
}

/**
 * Penggeser pilihan. Sorotannya diukur dari tombol yang aktif, jadi lebarnya selalu pas dengan teksnya.
 * `compact`: pil kecil (melayang atau di bilah lengket).
 */
export function Slider<T extends string>({
  value,
  options,
  onChange,
  label,
  compact = false,
  className = "",
  id,
}: {
  value: T;
  options: SlideOption<T>[];
  onChange: (v: T) => void;
  label: string;
  compact?: boolean;
  className?: string;
  id?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));

  useLayoutEffect(() => {
    const measure = () => {
      const b = refs.current[idx];
      if (b) setThumb({ x: b.offsetLeft, w: b.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    refs.current.forEach((b) => b && ro.observe(b));
    return () => ro.disconnect();
  }, [idx, options.length]);

  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (idx + d + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };

  return (
    <div ref={box} id={id} className={`lp-mode${compact ? " compact" : ""} ${className}`} role="radiogroup" aria-label={label} onKeyDown={onKey}>
      <span
        className={`lp-mode-thumb${thumb ? "" : " wait"}`}
        aria-hidden="true"
        style={thumb ? { transform: `translateX(${thumb.x}px)`, width: thumb.w } : undefined}
      />
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
          >
            {o.icon}
            <span className="t">
              <b>{compact ? o.short ?? o.label : o.label}</b>
              {!compact && o.sub && <small>{o.sub}</small>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const MODE_OPTIONS: SlideOption<Mode>[] = [
  { value: "kuliner", label: "Usaha makanan & minuman", short: "Makanan & minuman", sub: "Warung, kedai kopi, kafe, resto", icon: <UtensilsCrossed aria-hidden="true" /> },
  { value: "toko", label: "Toko barang", short: "Toko barang", sub: "Baju, aksesoris, kelontong, minimarket", icon: <ShoppingBag aria-hidden="true" /> },
];

export const SUB_OPTIONS: Record<Mode, SlideOption<Sub>[]> = {
  kuliner: [
    { value: "depan", label: "Yang dilihat pembeli", short: "Pembeli", sub: "Menu QR di HP pembeli", icon: <Smartphone aria-hidden="true" /> },
    { value: "belakang", label: "Yang dipakai pemilik & karyawan", short: "Pemilik & karyawan", sub: "Kasir, dapur, stok, laporan", icon: <ChefHat aria-hidden="true" /> },
  ],
  toko: [
    { value: "depan", label: "Di meja kasir", short: "Kasir", sub: "Scan, pilih ukuran, bayar", icon: <Store aria-hidden="true" /> },
    { value: "belakang", label: "Di HP pemilik", short: "Pemilik", sub: "Produk, stok, laporan", icon: <UserRound aria-hidden="true" /> },
  ],
};

/** Pil melayang di bawah layar, muncul setelah penggeser utama tergulir keluar layar. */
export function FloatingModeSwitch({ mode, onChange, watch }: { mode: Mode; onChange: (m: Mode) => void; watch: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // Dihitung dari posisi gulir, bukan IntersectionObserver: lompatan langsung ke bawah
    // (geser cepat, tombol akhir halaman) tidak memicu observer, sehingga pil bisa tertinggal di atas footer.
    let raf = 0;
    const sync = () => {
      raf = 0;
      const el = document.getElementById(watch);
      const end = document.getElementById("lp-end");
      if (!el) return;
      const past = el.getBoundingClientRect().bottom < 0;
      const atEnd = !!end && end.getBoundingClientRect().top < window.innerHeight;
      setShow(past && !atEnd);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(sync);
    };
    sync();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, [watch]);
  return (
    <div className={`lp-mode-float${show ? " show" : ""}`} aria-hidden={!show} inert={!show}>
      <Slider value={mode} options={MODE_OPTIONS} onChange={onChange} label="Jenis usaha" compact />
    </div>
  );
}
