import { useEffect, useRef, useState, type RefObject } from "react";

export function useReducedMotion() {
  const q = "(prefers-reduced-motion: reduce)";
  const [reduce, setReduce] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setReduce(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduce;
}

/** True selama elemen terlihat di layar dan tab browser aktif. Animasi berhenti kalau tidak dilihat, hemat baterai. */
export function useVisible(ref: RefObject<HTMLElement | null>, threshold = 0.2) {
  const [inView, setInView] = useState(false);
  const [tabOn, setTabOn] = useState(() => typeof document === "undefined" || !document.hidden);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold });
    io.observe(el);
    const vis = () => setTabOn(!document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, [ref, threshold]);
  return inView && tabOn;
}

/** Maju satu langkah tiap `dur(step)` ms selama `running`, lalu berulang. */
export function useStepper(count: number, dur: (step: number) => number, running: boolean) {
  const [step, setStep] = useState(0);
  const durRef = useRef(dur);
  durRef.current = dur;
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setStep((s) => (s + 1) % count), durRef.current(step));
    return () => window.clearTimeout(t);
  }, [step, running, count]);
  return [step, setStep] as const;
}

/**
 * Fase di dalam satu langkah: 0 di awal, naik satu tiap kali melewati `marks` (ms).
 * Saat tidak berjalan (dijeda / gerak dikurangi), langsung tampilkan keadaan akhir.
 */
export function usePhase(key: unknown, marks: number[], running: boolean, still = marks.length) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!running) {
      setPhase(still);
      return;
    }
    setPhase(0);
    const ts = marks.map((m, i) => window.setTimeout(() => setPhase(i + 1), m));
    return () => ts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, running]);
  return phase;
}

/** Angka yang naik pelan ke nilai baru. */
export function useCountUp(value: number, running: boolean, ms = 900) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    // Turun (mis. simulasi diulang dari awal) langsung lompat, tidak dihitung mundur.
    if (!running || from.current === value || value < from.current) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - (1 - k) ** 3;
      setShown(Math.round(a + (value - a) * e));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, running, ms]);
  return shown;
}
