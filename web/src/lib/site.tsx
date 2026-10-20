import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApi } from "./hooks";
import { DEFAULT_SITE, publicSite, type Site } from "../../../shared/site";

const FALLBACK = publicSite(DEFAULT_SITE);

/** Konten situs publik. Langsung tampil dari simpanan terakhir (atau isi bawaan), lalu diperbarui dari server. */
export function useSite(): Site {
  const { data } = useApi<{ site: Site }>("/api/public/site", { cache: true });
  return data?.site ?? FALLBACK;
}

/**
 * Tautan dari konten admin: jalur internal lewat router, "/#bagian" menggulir di landing,
 * tautan luar dibuka di tab baru.
 */
export function SiteLinkTo({ href, children, className, onClick }: { href: string; children: ReactNode; className?: string; onClick?: () => void }) {
  const { pathname } = useLocation();
  if (/^(https:|mailto:)/.test(href)) {
    return (
      <a className={className} href={href} onClick={onClick} {...(href.startsWith("https:") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {children}
      </a>
    );
  }
  if (href.startsWith("#") || (href.startsWith("/#") && pathname === "/")) {
    return <a className={className} href={href.replace(/^\//, "")} onClick={onClick}>{children}</a>;
  }
  return <Link className={className} to={href} onClick={onClick}>{children}</Link>;
}

/** Datang dari halaman lain ke "/#bagian": gulir ke bagiannya setelah halaman tampil. */
export function useScrollToHash() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const t = window.setTimeout(() => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView(), 80);
    return () => window.clearTimeout(t);
  }, [hash, pathname]);
}
