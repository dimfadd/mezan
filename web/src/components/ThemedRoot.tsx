import { useEffect, type CSSProperties, type ReactNode } from "react";
import { fontHref, themeVars, type MenuTheme } from "../../../shared/menuTheme";

/** Membungkus halaman pelanggan dengan tema toko: warna, font, sudut, dan gambar latar. */
export function ThemedRoot({ theme, children, className = "cust-root", style }: { theme: MenuTheme; children: ReactNode; className?: string; style?: CSSProperties }) {
  const href = fontHref(theme);
  useEffect(() => {
    if (!href) return;
    let link = document.querySelector<HTMLLinkElement>(`link[data-menu-font="${href}"]`);
    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.menuFont = href;
      document.head.appendChild(link);
    }
  }, [href]);
  const { "color-scheme": scheme, ...cssVars } = themeVars(theme);
  const vars = { ...cssVars, colorScheme: scheme } as CSSProperties;
  const bg: CSSProperties = theme.bgImage
    ? {
        // lapisan warna latar 85% di atas foto supaya teks tetap terbaca
        backgroundImage: `linear-gradient(color-mix(in srgb, ${theme.bg} 85%, transparent), color-mix(in srgb, ${theme.bg} 85%, transparent)), url("${theme.bgImage}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }
    : {};
  return (
    <div className={`${className} layout-${theme.layout}`} style={{ ...vars, ...bg, ...style }}>
      {children}
    </div>
  );
}
