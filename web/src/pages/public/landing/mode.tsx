import { useCallback, useEffect, useRef, useState } from "react";
import { ShoppingBag, UtensilsCrossed } from "lucide-react";

/** Isi landing dipilah per jenis usaha supaya halaman tidak kepanjangan dan tidak campur aduk. */
export type Mode = "kuliner" | "toko";

const KEY = "lp-mode";
// Bagian yang hanya ada di satu mode. Tautan ke bagian ini (dari menu atas, footer, halaman solusi) memindah mode.
const ONLY: Record<string, Mode> = {
  simulasi: "kuliner",
  antrean: "kuliner",
  pembeli: "kuliner",
  untung: "kuliner",
  fitur: "kuliner",
  "simulasi-toko": "toko",
  "fitur-toko": "toko",
};

const fromUrl = (): Mode | null => {
  const h = ONLY[decodeURIComponent(window.location.hash.slice(1))];
  if (h) return h;
  const u = new URLSearchParams(window.location.search).get("untuk");
  return u === "toko" || u === "kuliner" ? u : null;
};

const stored = (): Mode | null => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "toko" || v === "kuliner" ? v : null;
  } catch {
    return null;
  }
};

export function useLandingMode() {
  const [mode, setModeState] = useState<Mode>(() => fromUrl() ?? stored() ?? "kuliner");

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* mode browser privat: cukup diingat selama halaman terbuka */
    }
    // Alamat ikut berubah supaya tautannya bisa dibagikan apa adanya.
    const url = new URL(window.location.href);
    url.searchParams.set("untuk", m);
    url.hash = "";
    window.history.replaceState(window.history.state, "", url);
  }, []);

  // Klik tautan #bagian milik mode lain: pindah mode dulu, lalu useScrollToHash menggulir ke sana.
  useEffect(() => {
    const on = () => {
      const m = ONLY[decodeURIComponent(window.location.hash.slice(1))];
      if (m) setModeState(m);
    };
    window.addEventListener("hashchange", on);
    window.addEventListener("popstate", on);
    return () => {
      window.removeEventListener("hashchange", on);
      window.removeEventListener("popstate", on);
    };
  }, []);

  return [mode, setMode] as const;
}

const OPTIONS: { m: Mode; label: string; short: string; sub: string; icon: typeof ShoppingBag }[] = [
  { m: "kuliner", label: "Usaha makanan & minuman", short: "Makanan & minuman", sub: "Warung, kedai kopi, kafe, resto", icon: UtensilsCrossed },
  { m: "toko", label: "Toko barang", short: "Toko barang", sub: "Baju, aksesoris, kelontong, minimarket", icon: ShoppingBag },
];

/** Penggeser dua pilihan. `compact` dipakai di pil melayang saat pengunjung sudah menggulir jauh. */
export function ModeSwitch({ mode, onChange, compact = false, id }: { mode: Mode; onChange: (m: Mode) => void; compact?: boolean; id?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next = mode === "kuliner" ? 1 : 0;
    onChange(OPTIONS[next].m);
    refs.current[next]?.focus();
  };
  return (
    <div
      id={id}
      className={`lp-mode${compact ? " compact" : ""}`}
      data-on={mode}
      role="radiogroup"
      aria-label="Jenis usaha"
      onKeyDown={onKey}
    >
      <span className="lp-mode-thumb" aria-hidden="true" />
      {OPTIONS.map((o, i) => {
        const Icon = o.icon;
        const on = o.m === mode;
        return (
          <button
            key={o.m}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.m)}
          >
            <Icon aria-hidden="true" />
            <span className="t">
              <b>{compact ? o.short : o.label}</b>
              {!compact && <small>{o.sub}</small>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Pil melayang di bawah layar, muncul setelah penggeser utama tergulir keluar layar. */
export function FloatingModeSwitch({ mode, onChange, watch }: { mode: Mode; onChange: (m: Mode) => void; watch: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.getElementById(watch);
    const end = document.getElementById("lp-end");
    if (!el) return;
    let past = false;
    let atEnd = false;
    const sync = () => setShow(past && !atEnd);
    const io = new IntersectionObserver(([e]) => {
      past = !e.isIntersecting && e.boundingClientRect.top < 0;
      sync();
    });
    // Sembunyikan di ajakan penutup & footer supaya tidak menutupi tombol daftar.
    const io2 = new IntersectionObserver(([e]) => {
      atEnd = e.isIntersecting || e.boundingClientRect.top < 0;
      sync();
    });
    io.observe(el);
    if (end) io2.observe(end);
    return () => {
      io.disconnect();
      io2.disconnect();
    };
  }, [watch]);
  return (
    <div className={`lp-mode-float${show ? " show" : ""}`} aria-hidden={!show} inert={!show}>
      <ModeSwitch mode={mode} onChange={onChange} compact />
    </div>
  );
}
