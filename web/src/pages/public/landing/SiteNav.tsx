import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, Menu, X } from "lucide-react";
import { useSession } from "../../../lib/session";
import { SiteLinkTo, useSite } from "../../../lib/site";
import type { NavGroup } from "../../../../../shared/site";

function homeFor(role?: string) {
  return role === "platform_admin" ? "/admin" : "/toko/pesanan";
}

/** Menu atas situs publik. Isinya diatur dari panel admin (Konten situs). */
export function SiteNav() {
  const site = useSite();
  const { user } = useSession();
  const { pathname, hash } = useLocation();
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const bar = useRef<HTMLElement>(null);

  // Tutup saat pindah halaman, klik di luar, atau tekan Escape.
  useEffect(() => {
    setOpen(null);
    setSheet(false);
  }, [pathname, hash]);
  useEffect(() => {
    const out = (e: PointerEvent) => !bar.current?.contains(e.target as Node) && setOpen(null);
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setSheet(false);
      }
    };
    document.addEventListener("pointerdown", out);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", out);
      document.removeEventListener("keydown", esc);
    };
  }, []);
  useEffect(() => {
    document.body.style.overflow = sheet ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheet]);

  const close = () => {
    setOpen(null);
    setSheet(false);
  };
  const groups = site.nav.filter((g) => g.href || g.sections.some((s) => s.items.length));
  const actions = user ? (
    <Link className="btn btn-primary" to={homeFor(user.role)}>Buka dasbor</Link>
  ) : (
    <>
      <Link className="btn btn-ghost" to="/masuk">Masuk</Link>
      <Link className="btn btn-primary" to="/daftar">Coba gratis</Link>
    </>
  );

  return (
    <nav ref={bar} className="sn" aria-label="Utama">
      <Link className="wordmark" to="/" onClick={close}>pesan<span className="dot">.</span>in</Link>
      <ul className="sn-groups">
        {groups.map((g) => (
          <li key={g.label} className="sn-g">
            {g.href ? (
              <SiteLinkTo className="sn-top" href={g.href}>{g.label}</SiteLinkTo>
            ) : (
              <>
                <button
                  type="button"
                  className="sn-top"
                  aria-expanded={open === g.label}
                  onClick={() => setOpen(open === g.label ? null : g.label)}
                >
                  {g.label} <ChevronDown aria-hidden="true" />
                </button>
                {open === g.label && <Panel g={g} onPick={close} />}
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="sn-act">{actions}</div>
      <button type="button" className="icon-btn sn-burger" aria-label="Buka menu" aria-expanded={sheet} onClick={() => setSheet(true)}>
        <Menu />
      </button>

      {/* Di luar bilah atas: blur pada bilah membuat posisi fixed ikut terkunci ke bilah. */}
      {sheet && createPortal(
        <div className="sn-sheet" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="sn-sheet-top">
            <Link className="wordmark" to="/" onClick={close}>pesan<span className="dot">.</span>in</Link>
            <button type="button" className="icon-btn" aria-label="Tutup menu" onClick={() => setSheet(false)} autoFocus>
              <X />
            </button>
          </div>
          <div className="sn-sheet-body">
            {groups.map((g) =>
              g.href ? (
                <SiteLinkTo key={g.label} className="sn-sheet-link strong" href={g.href} onClick={close}>{g.label}</SiteLinkTo>
              ) : (
                <details key={g.label} className="sn-acc">
                  <summary>{g.label} <ChevronDown aria-hidden="true" /></summary>
                  {g.sections.map((s, i) => (
                    <div key={i} className="sn-acc-sec">
                      {s.title && <span className="sn-h">{s.title}</span>}
                      {s.items.map((it) => (
                        <SiteLinkTo key={it.href + it.label} className="sn-sheet-link" href={it.href} onClick={close}>{it.label}</SiteLinkTo>
                      ))}
                    </div>
                  ))}
                </details>
              ),
            )}
          </div>
          <div className="sn-sheet-act">{actions}</div>
        </div>,
        document.body,
      )}
    </nav>
  );
}

function Panel({ g, onPick }: { g: NavGroup; onPick: () => void }) {
  const secs = g.sections.filter((s) => s.items.length);
  return (
    <div className={`sn-panel${secs.length > 1 ? " multi" : ""}`}>
      {secs.map((s, i) => (
        <div key={i} className="sn-sec">
          {s.title && <span className="sn-h">{s.title}</span>}
          {s.items.map((it) => (
            <SiteLinkTo key={it.href + it.label} className="sn-item" href={it.href} onClick={onPick}>
              <span>{it.label}</span>
              {it.desc && <small>{it.desc}</small>}
            </SiteLinkTo>
          ))}
        </div>
      ))}
    </div>
  );
}
