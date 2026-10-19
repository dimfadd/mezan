import { useEffect, useRef, useState } from "react";
import { Check, ChefHat, CupSoda, Expand, Minimize, CircleCheck, Circle } from "lucide-react";
import { Empty, ErrorState, Loading, PageHead, Segmented, useToast } from "../../components/ui";
import { soundEnabled } from "../../components/Shell";
import { api } from "../../lib/api";
import { useApi } from "../../lib/hooks";

type Station = "all" | "kitchen" | "bar";
interface KItem {
  id: string;
  name: string;
  qty: number;
  note: string;
  person: string;
  station: "kitchen" | "bar";
  ready_at: number | null;
  prep_minutes: number | null;
}
interface KOrder {
  id: string;
  number: number;
  table_label: string | null;
  order_type: string;
  customer_name: string;
  note: string;
  created_at: number;
  accepted_at: number | null;
  items: KItem[];
  other_open: number;
}

const KEY = "pesanin-station";

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.52);
  } catch {
    /* audio diblokir sebelum ada ketukan */
  }
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Layar untuk dapur/bar: hanya yang perlu dibuat, dengan waktu tunggu yang terlihat dari jauh. */
export function KitchenPage() {
  const [station, setStation] = useState<Station>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v === "kitchen" || v === "bar" ? v : "all";
    } catch {
      return "all";
    }
  });
  const pick = (v: Station) => {
    setStation(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* abaikan */
    }
  };
  const { data, error, loading, reload, setData } = useApi<{ orders: KOrder[]; waiting_accept: number; now: number }>(`/api/store/kitchen?station=${station}`, { poll: 5000 });
  const toast = useToast();
  const [now, setNow] = useState(Date.now());
  const [full, setFull] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const offset = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!data) return;
    offset.current = data.now - Date.now();
    const ids = new Set(data.orders.map((o) => o.id));
    if (seen.current && [...ids].some((id) => !seen.current!.has(id)) && soundEnabled()) beep();
    seen.current = ids;
  }, [data]);
  useEffect(() => {
    seen.current = null; // ganti bagian: jangan bunyi untuk pesanan yang sudah ada
  }, [station]);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const toggleItem = async (o: KOrder, it: KItem) => {
    const ready = !it.ready_at;
    setData((d) => d && { ...d, orders: d.orders.map((x) => (x.id === o.id ? { ...x, items: x.items.map((y) => (y.id === it.id ? { ...y, ready_at: ready ? Date.now() : null } : y)) } : x)) });
    try {
      const r = await api.patch<{ advanced: boolean }>(`/api/store/kitchen/items/${it.id}`, { ready });
      if (r.advanced) toast(`Pesanan #${o.number} lengkap, ditandai Siap diantar.`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
    reload(true);
  };
  const finish = async (o: KOrder) => {
    try {
      const r = await api.post<{ advanced: boolean }>(`/api/store/kitchen/orders/${o.id}/done`, { station });
      toast(r.advanced ? `Pesanan #${o.number} siap diantar.` : `Bagian ${station === "bar" ? "bar" : "dapur"} untuk #${o.number} selesai. Menunggu bagian lain.`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
    reload(true);
  };

  const t = now + offset.current;
  return (
    <div ref={box} className={`kds${full ? " is-full" : ""}`}>
      <PageHead
        title="Layar dapur"
        sub="Pesanan yang sudah diterima kasir. Ketuk item yang sudah jadi; kalau semua selesai, pesanan otomatis Siap diantar."
        actions={
          <>
            <Segmented
              label="Bagian"
              value={station}
              onChange={pick}
              options={[
                { value: "all", label: "Semua" },
                { value: "kitchen", label: <><ChefHat aria-hidden="true" /> Dapur</> },
                { value: "bar", label: <><CupSoda aria-hidden="true" /> Bar</> },
              ]}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={full ? "Keluar layar penuh" : "Layar penuh"}
              title={full ? "Keluar layar penuh" : "Layar penuh"}
              onClick={() => {
                const p = document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen?.();
                p?.catch(() => {});
              }}
            >
              {full ? <Minimize /> : <Expand />}
            </button>
          </>
        }
      />
      {!!data?.waiting_accept && (
        <p className="banner info" role="status" style={{ marginBottom: 14 }}>
          {data.waiting_accept} pesanan QR menunggu diterima kasir. Muncul di sini setelah diterima.
        </p>
      )}
      {error && !data ? (
        <ErrorState message={error.message} onRetry={() => reload()} />
      ) : loading || !data ? (
        <Loading rows={3} height={160} />
      ) : data.orders.length === 0 ? (
        <div className="panel">
          <Empty icon={<ChefHat aria-hidden="true" />} title="Tidak ada yang perlu dibuat">
            {station === "all" ? "Pesanan baru muncul di sini setelah kasir menerimanya." : `Belum ada pesanan untuk bagian ${station === "bar" ? "bar" : "dapur"}.`}
          </Empty>
        </div>
      ) : (
        <div className="kds-grid">
          {data.orders.map((o) => {
            const since = o.accepted_at ?? o.created_at;
            const elapsed = t - since;
            // Batas waktu = waktu saji terlama di pesanan ini (diisi di menu), atau 10 menit kalau belum diisi.
            const preps = o.items.map((i) => i.prep_minutes ?? 0).filter((m) => m > 0);
            const limit = preps.length ? Math.max(...preps) : 10;
            const level = elapsed >= limit * 1.5 * 60000 ? "late" : elapsed >= limit * 60000 ? "warn" : "";
            const persons = new Set(o.items.map((i) => i.person).filter(Boolean)).size > 1;
            const left = o.items.filter((i) => !i.ready_at).length;
            return (
              <article key={o.id} className={`kds-ticket ${level}`} aria-label={`Pesanan ${o.number}`}>
                <header>
                  <div>
                    <div className="kds-no num">#{o.number}</div>
                    <div className="small">{o.table_label ?? (o.order_type === "takeaway" ? "Bawa pulang" : "Kasir")}{o.customer_name ? ` · ${o.customer_name}` : ""}</div>
                  </div>
                  <div className="kds-timer num" aria-label={`Menunggu ${Math.floor(elapsed / 60000)} menit`} title={`Target ±${limit} menit`}>{mmss(elapsed)}</div>
                </header>
                <ul>
                  {o.items.map((i) => (
                    <li key={i.id}>
                      <button type="button" className={i.ready_at ? "done" : ""} aria-pressed={!!i.ready_at} onClick={() => toggleItem(o, i)}>
                        {i.ready_at ? <CircleCheck aria-hidden="true" /> : <Circle aria-hidden="true" />}
                        <span className="q num">{i.qty}×</span>
                        <span className="nm">
                          {i.name}
                          {station === "all" && <span className={`kds-st ${i.station}`}>{i.station === "bar" ? "Bar" : "Dapur"}</span>}
                          {persons && i.person && <span className="person-tag">{i.person}</span>}
                          {i.note && <span className="note">{i.note}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {o.note && <p className="small" style={{ color: "var(--warn-text)", fontWeight: 650 }}>Catatan: {o.note}</p>}
                {o.other_open > 0 && <p className="tiny muted">+{o.other_open} item di bagian lain masih dibuat.</p>}
                <button type="button" className="btn btn-primary btn-block" disabled={left === 0} onClick={() => finish(o)}>
                  <Check /> {station === "all" ? "Semua selesai" : `Bagian ${station === "bar" ? "bar" : "dapur"} selesai`}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
