import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BellRing, Minus, Plus, Users } from "lucide-react";
import { ErrorState, Field, Loading, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { LangSwitch, useLang } from "../../lib/lang";
import { ThemedRoot } from "../../components/ThemedRoot";
import { DEFAULT_THEME, type MenuTheme } from "../../../../shared/menuTheme";

const tokenKey = (code: string) => `pesanin-antre-${code}`;

function getLocation(): Promise<{ lat: number; lng: number; acc: number } | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/** QR di pintu: daftar antrean tanpa aplikasi. */
export function WaitlistJoinPage() {
  const { code = "" } = useParams();
  const nav = useNavigate();
  const { lang, setLang, t } = useLang();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ store: { name: string; theme?: MenuTheme }; open: boolean; waiting: number; geo: { check: boolean } }>(`/api/public/waitlist/${code}?lang=${lang}`, { poll: 15000 });
  const [name, setName] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mezan-name") ?? '""') as string;
    } catch {
      return "";
    }
  });
  const [party, setParty] = useState(2);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  // Sudah antre dari HP ini dan belum selesai: langsung ke halaman nomornya.
  useEffect(() => {
    try {
      const tok = localStorage.getItem(tokenKey(code));
      if (tok) nav(`/antre/${code}/${tok}`, { replace: true });
    } catch {
      /* abaikan */
    }
  }, [code, nav]);
  useEffect(() => {
    if (data) document.title = `${t.waitTitle} · ${data.store.name}`;
  }, [data, t]);

  if (error && !data) return <div className="cust"><ErrorState title={t.loadFail} retryLabel={t.retry} message={error.message} onRetry={() => reload()} /></div>;
  if (loading || !data) return <div className="cust" style={{ padding: 16 }}><Loading rows={3} height={80} /></div>;

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const loc = data.geo.check ? await getLocation() : null;
      const r = await api.post<{ token: string }>(`/api/public/waitlist/${code}`, { name: name.trim(), party, phone, lang, loc });
      try {
        localStorage.setItem(tokenKey(code), r.token);
        localStorage.setItem("mezan-name", JSON.stringify(name.trim()));
      } catch {
        /* mode privat */
      }
      nav(`/antre/${code}/${r.token}`, { replace: true });
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedRoot theme={data.store.theme ?? DEFAULT_THEME}>
      <div className="cust wait-page">
        <div className="cust-top">
          <span className="table-tag"><Users aria-hidden="true" /> {t.waitTitle}</span>
          <LangSwitch lang={lang} setLang={setLang} />
        </div>
        <h1 className="store">{data.store.name}</h1>
        <p className="muted">{t.waitCount(data.waiting)}</p>
        {!data.open ? (
          <div className="banner info">{t.waitClosed}</div>
        ) : (
          <form className="panel stack" onSubmit={join}>
            <p className="small muted">{t.waitJoinSub}</p>
            <Field label={t.yourName} htmlFor="w-name">
              <input id="w-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoComplete="given-name" placeholder={t.yourNamePh} />
            </Field>
            <div className="field">
              <span className="field-label" id="w-party-l">{t.waitParty}</span>
              <div className="qty qty-lg" role="group" aria-labelledby="w-party-l">
                <button type="button" onClick={() => setParty((p) => Math.max(1, p - 1))} aria-label={t.less}><Minus /></button>
                <span className="num" aria-live="polite">{party}</span>
                <button type="button" onClick={() => setParty((p) => Math.min(50, p + 1))} aria-label={t.more}><Plus /></button>
              </div>
            </div>
            <Field label={t.waitPhone} htmlFor="w-phone" hint={t.waitPhoneHint}>
              <input id="w-phone" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} placeholder="0812 3456 7890" autoComplete="tel" />
            </Field>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy || !name.trim()}>{busy ? t.sending : t.waitJoin}</button>
          </form>
        )}
      </div>
    </ThemedRoot>
  );
}

function ring() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((d) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + d);
      o.stop(ctx.currentTime + d + 0.22);
    });
  } catch {
    /* audio diblokir */
  }
}

interface WaitEntry {
  entry: { number: number; name: string; party: number; status: "waiting" | "called" | "seated" | "cancelled" | "noshow"; table_label: string | null; created_at: number };
  ahead: number;
  store: { name: string; theme?: MenuTheme; code: string | null };
}

export function WaitlistStatusPage() {
  const { code = "", token = "" } = useParams();
  const nav = useNavigate();
  const { lang, setLang, t } = useLang();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<WaitEntry>(`/api/public/waitlist/entry/${token}?lang=${lang}`, { poll: 8000 });
  const prev = useRef<string | null>(null);
  const status = data?.entry.status;
  const finished = status === "seated" || status === "cancelled" || status === "noshow";

  useEffect(() => {
    if (!status) return;
    if (prev.current && prev.current !== "called" && status === "called") {
      ring();
      navigator.vibrate?.([300, 120, 300, 120, 300]);
    }
    prev.current = status;
    document.title = status === "called" ? `${t.waitCalled} · A${data!.entry.number}` : `A${data!.entry.number} · ${data!.store.name}`;
    if (finished) {
      try {
        if (localStorage.getItem(tokenKey(code)) === token) localStorage.removeItem(tokenKey(code));
      } catch {
        /* abaikan */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, data]);

  if (error && !data) return <div className="cust"><ErrorState title={t.loadFail} retryLabel={t.retry} message={error.message} onRetry={error.status === 404 ? undefined : () => reload()} /></div>;
  if (loading || !data) return <div className="cust" style={{ padding: 16 }}><Loading rows={3} height={80} /></div>;
  const e = data.entry;

  const leave = async () => {
    try {
      await api.del(`/api/public/waitlist/entry/${token}`);
      reload(true);
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  return (
    <ThemedRoot theme={data.store.theme ?? DEFAULT_THEME}>
      <div className={`cust wait-page${status === "called" ? " is-called" : ""}`}>
        <div className="cust-top">
          <span className="table-tag"><Users aria-hidden="true" /> {data.store.name}</span>
          <LangSwitch lang={lang} setLang={setLang} />
        </div>
        <div className="wait-card" role="status" aria-live="assertive">
          {status === "called" ? (
            <>
              <BellRing aria-hidden="true" className="wait-bell" />
              <h1>{t.waitCalled}</h1>
              <p>{t.waitCalledSub}</p>
            </>
          ) : (
            <span className="small muted">{t.waitNumber}</span>
          )}
          <div className="wait-no num">A{e.number}</div>
          <p className="small muted">{e.name} · {e.party} {lang === "en" ? (e.party === 1 ? "person" : "people") : "orang"}</p>
          {status === "waiting" && (
            <>
              <p className="strong">{t.waitAhead(data.ahead)}</p>
              <p className="tiny muted">{t.waitKeepOpen}</p>
            </>
          )}
          {status === "seated" && <p className="strong">{t.waitSeated}{e.table_label ? ` · ${e.table_label}` : ""}</p>}
          {(status === "cancelled" || status === "noshow") && <p>{t.waitCancelledMsg}</p>}
        </div>
        {status === "waiting" && (
          <button type="button" className="btn btn-ghost" onClick={leave}>{t.waitCancel}</button>
        )}
        {finished && code && (
          <button type="button" className="btn" onClick={() => nav(`/antre/${code}`, { replace: true })}>{t.waitAgain}</button>
        )}
      </div>
    </ThemedRoot>
  );
}
