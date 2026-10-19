import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";

const CACHE = "pesanin-cache:";

export function readCache<T>(path: string): T | null {
  try {
    const v = localStorage.getItem(CACHE + path);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export function clearApiCache() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(CACHE)) localStorage.removeItem(k);
  } catch {
    /* abaikan */
  }
}

/**
 * Ambil data dari API, dengan opsi polling (untuk pesanan masuk).
 * `cache`: simpan hasil terakhir di HP supaya halaman tetap bisa dipakai saat internet putus (dipakai kasir).
 */
export function useApi<T>(path: string | null, opts: { poll?: number; cache?: boolean } = {}) {
  const [data, setData] = useState<T | null>(() => (path && opts.cache ? readCache<T>(path) : null));
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [stale, setStale] = useState(false);
  const pathRef = useRef(path);
  pathRef.current = path;
  const cacheRef = useRef(!!opts.cache);

  const load = useCallback(async (silent = false) => {
    const p = pathRef.current;
    if (!p) return;
    if (!silent) setLoading(true);
    try {
      const d = await api.get<T>(p);
      if (pathRef.current === p) {
        setData(d);
        setError(null);
        setStale(false);
      }
      if (cacheRef.current) {
        try {
          localStorage.setItem(CACHE + p, JSON.stringify(d));
        } catch {
          /* penyimpanan penuh: tetap jalan tanpa simpanan */
        }
      }
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, String(e));
      // Offline tapi ada simpanan: tetap tampilkan data lama, jangan layar galat.
      if (pathRef.current === p && cacheRef.current && err.status === 0 && readCache(p)) {
        setStale(true);
        return;
      }
      if (pathRef.current === p) setError(err);
    } finally {
      if (pathRef.current === p) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!path) return;
    load();
  }, [path, load]);

  useEffect(() => {
    if (!path || !opts.poll) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, opts.poll);
    const onVis = () => document.visibilityState === "visible" && load(true);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [path, opts.poll, load]);

  return { data, error, loading: loading && !data, reload: load, setData, stale };
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}
