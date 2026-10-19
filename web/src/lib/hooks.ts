import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";

/** Ambil data dari API, dengan opsi polling (untuk pesanan masuk). */
export function useApi<T>(path: string | null, opts: { poll?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const pathRef = useRef(path);
  pathRef.current = path;

  const load = useCallback(async (silent = false) => {
    const p = pathRef.current;
    if (!p) return;
    if (!silent) setLoading(true);
    try {
      const d = await api.get<T>(p);
      if (pathRef.current === p) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (pathRef.current === p) setError(e instanceof ApiError ? e : new ApiError(0, String(e)));
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

  return { data, error, loading: loading && !data, reload: load, setData };
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
