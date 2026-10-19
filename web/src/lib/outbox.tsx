import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, ApiError } from "./api";

/**
 * Kotak keluar kasir: pesanan yang dicatat saat internet putus disimpan di HP ini,
 * lalu dikirim otomatis saat sinyal kembali. Setiap pesanan membawa ID sendiri,
 * jadi kiriman ulang (mis. jawaban server hilang di jalan) tidak membuat pesanan dobel.
 */
export interface OutboxEntry {
  clientId: string;
  at: number;
  label: number; // nomor sementara: Offline 1, Offline 2, ...
  total: number;
  summary: string;
  body: Record<string, unknown>;
  error?: string;
}

interface Ctx {
  entries: OutboxEntry[];
  online: boolean;
  syncing: boolean;
  add: (e: Omit<OutboxEntry, "label">) => OutboxEntry;
  flush: () => Promise<void>;
  discard: (clientId: string) => void;
  lastSynced: { count: number; numbers: number[] } | null;
}

const OutboxCtx = createContext<Ctx | null>(null);
const key = (tenantId: string) => `pesanin-outbox-${tenantId}`;

function load(tenantId: string): OutboxEntry[] {
  try {
    const v = localStorage.getItem(key(tenantId));
    return v ? (JSON.parse(v) as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

export function newClientId() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function OutboxProvider({ tenantId, onSynced, children }: { tenantId: string; onSynced?: () => void; children: ReactNode }) {
  const [entries, setEntries] = useState<OutboxEntry[]>(() => load(tenantId));
  const [online, setOnline] = useState(() => navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Ctx["lastSynced"]>(null);
  const ref = useRef(entries);
  const busy = useRef(false);
  const syncedCb = useRef(onSynced);
  syncedCb.current = onSynced;

  const save = useCallback(
    (next: OutboxEntry[]) => {
      ref.current = next;
      setEntries(next);
      try {
        localStorage.setItem(key(tenantId), JSON.stringify(next));
      } catch {
        /* penyimpanan penuh: tetap di memori */
      }
    },
    [tenantId],
  );

  const add = useCallback(
    (e: Omit<OutboxEntry, "label">) => {
      const label = (ref.current.reduce((m, x) => Math.max(m, x.label), 0) || 0) + 1;
      const entry = { ...e, label };
      save([...ref.current, entry]);
      return entry;
    },
    [save],
  );

  const flush = useCallback(async () => {
    if (busy.current || ref.current.length === 0) return;
    busy.current = true;
    setSyncing(true);
    const numbers: number[] = [];
    try {
      for (const e of [...ref.current]) {
        if (e.error) continue; // ditolak server; menunggu keputusan kasir
        try {
          const r = await api.post<{ number: number }>("/api/store/orders", { ...e.body, clientId: e.clientId, offlineAt: e.at });
          numbers.push(r.number);
          save(ref.current.filter((x) => x.clientId !== e.clientId));
          setOnline(true);
        } catch (err) {
          const status = err instanceof ApiError ? err.status : 0;
          if (status === 0 || status === 401 || status >= 500) {
            if (status === 0) setOnline(false);
            break; // masih offline / sesi habis / server bermasalah: coba lagi nanti
          }
          save(ref.current.map((x) => (x.clientId === e.clientId ? { ...x, error: (err as Error).message } : x)));
        }
      }
    } finally {
      busy.current = false;
      setSyncing(false);
      if (numbers.length) {
        setLastSynced({ count: numbers.length, numbers });
        syncedCb.current?.();
      }
    }
  }, [save]);

  const discard = useCallback((clientId: string) => save(ref.current.filter((x) => x.clientId !== clientId)), [save]);

  useEffect(() => {
    const on = () => {
      setOnline(true);
      flush();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    flush();
    // Sinyal kadang kembali tanpa event "online" (Wi-Fi tersambung tapi internet belum), jadi coba berkala.
    const id = window.setInterval(() => {
      if (ref.current.some((e) => !e.error)) flush();
    }, 15000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.clearInterval(id);
    };
  }, [flush]);

  return <OutboxCtx.Provider value={{ entries, online, syncing, add, flush, discard, lastSynced }}>{children}</OutboxCtx.Provider>;
}

export function useOutbox() {
  const c = useContext(OutboxCtx);
  if (!c) throw new Error("useOutbox di luar OutboxProvider");
  return c;
}
