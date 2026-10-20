import { useEffect, useState } from "react";
import { Clock3, Mail, MapPin, MessageCircle, Smartphone } from "lucide-react";
import { SiteLinkTo, useSite } from "../../../lib/site";
import { waLink } from "../../../../../shared/site";
import { LegalFoot } from "../Legal";
import { ThemeToggle } from "../../../components/ThemeToggle";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * Pesan.in adalah aplikasi web (PWA), bukan aplikasi Play Store/App Store.
 * Kartu ini menawarkan "pasang ke layar utama" yang sebenarnya, bukan lencana toko aplikasi.
 */
function InstallCard() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    const ok = () => setDone(true);
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", ok);
    return () => {
      window.removeEventListener("beforeinstallprompt", on);
      window.removeEventListener("appinstalled", ok);
    };
  }, []);
  return (
    <div className="sf-install">
      <span className="ic"><Smartphone aria-hidden="true" /></span>
      <div>
        <b>Pasang di HP, tanpa Play Store</b>
        <p>
          {done
            ? "Sudah terpasang. Buka dari ikon pesan.in di layar utama."
            : evt
              ? "Ikon pesan.in muncul di layar utama seperti aplikasi biasa."
              : "Buka di Chrome atau Safari, lalu pilih \"Tambahkan ke layar utama\"."}
        </p>
        {evt && !done && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={async () => {
              await evt.prompt();
              const r = await evt.userChoice;
              if (r.outcome === "accepted") setDone(true);
              setEvt(null);
            }}
          >
            Pasang sekarang
          </button>
        )}
      </div>
    </div>
  );
}

export function SiteFooter() {
  const { footer } = useSite();
  const c = footer.contact;
  const wa = waLink(c.whatsapp);
  const hasContact = c.email || wa || c.address || c.hours;
  return (
    <footer className="sf" id="kontak">
      <div className="sf-in">
        <div className="sf-brand">
          <span className="wordmark">pesan<span className="dot">.</span>in</span>
          {footer.tagline && <p>{footer.tagline}</p>}
          {hasContact && (
            <ul className="sf-contact" aria-label="Hubungi kami">
              {wa && <li><MessageCircle aria-hidden="true" /><a href={wa} target="_blank" rel="noopener noreferrer">WhatsApp {c.whatsapp}</a></li>}
              {c.email && <li><Mail aria-hidden="true" /><a href={`mailto:${c.email}`}>{c.email}</a></li>}
              {c.hours && <li><Clock3 aria-hidden="true" /><span>{c.hours}</span></li>}
              {c.address && <li><MapPin aria-hidden="true" /><span>{c.address}</span></li>}
            </ul>
          )}
          <InstallCard />
          <div className="sf-theme"><ThemeToggle /></div>
        </div>
        {footer.columns.filter((col) => col.links.length).map((col) => (
          <nav key={col.title} className="sf-col" aria-label={col.title}>
            <span className="sf-h">{col.title}</span>
            {col.links.map((l) => (
              <SiteLinkTo key={l.href + l.label} href={l.href}>{l.label}</SiteLinkTo>
            ))}
          </nav>
        ))}
      </div>
      <LegalFoot />
    </footer>
  );
}
