import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import type { Lang } from "../../../../shared/i18n";

export interface CartLine {
  id: string;
  qty: number;
  note: string;
}
export interface SharedLine {
  id: string;
  item_id: string;
  qty: number;
  note: string;
  person: string;
  mine: boolean;
}
export interface TableState {
  lines: SharedLine[];
  people: number;
  orders: { token: string; number: number; name: string; status: string; at: number }[];
  calls: { kind: "waiter" | "bill"; created_at: number }[];
}

const DEVICE_KEY = "pesanin-device";

/** Pengenal acak HP ini, supaya pilihan tiap orang di keranjang meja bisa dibedakan. Bukan data pribadi. */
export function deviceId() {
  try {
    const v = localStorage.getItem(DEVICE_KEY);
    if (v && /^[a-z0-9]{8,40}$/.test(v)) return v;
    const n = [...crypto.getRandomValues(new Uint8Array(10))].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
    localStorage.setItem(DEVICE_KEY, n);
    return n;
  } catch {
    return "tamu" + Math.random().toString(36).slice(2, 12);
  }
}

/**
 * Keranjang bersama satu meja. Server yang memegang isinya; HP ini menyimpan pilihannya sendiri
 * secara optimis lalu mengirimnya sebentar kemudian. Polling cepat hanya saat ada teman semeja
 * atau keranjang sedang dibuka, supaya hemat kuota pembeli dan server.
 */
export function useTableSession(code: string, enabled: boolean, lang: Lang, onError: (msg: string) => void) {
  const device = useRef(deviceId()).current;
  const [state, setState] = useState<TableState | null>(null);
  const [mine, setMineState] = useState<CartLine[]>([]);
  const mineRef = useRef<CartLine[]>([]);
  const person = useRef("");
  const dirty = useRef(false);
  const ver = useRef(0); // naik setiap ada perubahan lokal yang belum terkirim
  const pushTimer = useRef<number | undefined>(undefined);
  const fast = useRef(false);
  const kick = useRef<() => void>(() => {});
  const errRef = useRef(onError);
  errRef.current = onError;

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const s = await api.get<TableState>(`/api/public/table/${code}/state?device=${device}&lang=${lang}`);
      setState(s);
      if (!dirty.current) {
        const next = s.lines.filter((l) => l.mine).map((l) => ({ id: l.item_id, qty: l.qty, note: l.note }));
        mineRef.current = next;
        setMineState(next);
      }
    } catch {
      /* jaringan putus sebentar: coba lagi di putaran berikutnya */
    }
  }, [code, device, enabled, lang]);

  const pushNow = useCallback(async () => {
    window.clearTimeout(pushTimer.current);
    if (!dirty.current) return;
    const v = ver.current;
    try {
      await api.put(`/api/public/table/${code}/cart`, { device, person: person.current, lines: mineRef.current, lang });
    } catch (e) {
      errRef.current((e as Error).message);
    }
    // Kalau ada perubahan baru selama mengirim, biarkan pengiriman berikutnya yang menyelesaikan.
    if (ver.current === v) {
      dirty.current = false;
      await refresh();
    }
  }, [code, device, lang, refresh]);

  const schedulePush = useCallback(() => {
    ver.current++;
    dirty.current = true;
    window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(pushNow, 450);
  }, [pushNow]);

  const setMine = useCallback(
    (fn: CartLine[] | ((c: CartLine[]) => CartLine[])) => {
      const next = typeof fn === "function" ? fn(mineRef.current) : fn;
      mineRef.current = next;
      setMineState(next);
      schedulePush();
    },
    [schedulePush],
  );

  const setPerson = useCallback(
    (name: string) => {
      if (person.current === name) return;
      person.current = name;
      if (mineRef.current.length) schedulePush();
    },
    [schedulePush],
  );

  /** Setelah pesanan meja terkirim, server sudah mengosongkan keranjang. */
  const reset = useCallback(() => {
    window.clearTimeout(pushTimer.current);
    dirty.current = false;
    mineRef.current = [];
    setMineState([]);
    refresh();
  }, [refresh]);

  const removeLine = useCallback(
    async (id: string) => {
      try {
        await api.del(`/api/public/table/${code}/cart/${id}`);
      } catch (e) {
        errRef.current((e as Error).message);
      }
      await refresh();
    },
    [code, refresh],
  );

  // Polling adaptif: 4 detik saat ramai/terbuka, 20 detik saat sendirian, berhenti saat tab disembunyikan.
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    let t: number | undefined;
    const loop = async () => {
      window.clearTimeout(t);
      if (document.visibilityState === "visible") await refresh();
      if (!stop) {
        window.clearTimeout(t);
        t = window.setTimeout(loop, fast.current ? 4000 : 20000);
      }
    };
    kick.current = loop;
    loop();
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, refresh]);

  const setFast = useCallback((v: boolean) => {
    const was = fast.current;
    fast.current = v;
    // Baru ramai / keranjang dibuka: segarkan sekarang dan pakai jeda pendek mulai putaran ini.
    if (v && !was) kick.current();
  }, []);

  return { device, state, mine, setMine, setPerson, flush: pushNow, reset, removeLine, refresh, setFast };
}
