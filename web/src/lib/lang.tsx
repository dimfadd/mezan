import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { DICT, type Lang } from "../../../shared/i18n";

const KEY = "mezan-lang";

function initialLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "id" || v === "en") return v;
  } catch {
    /* penyimpanan diblokir */
  }
  // Belum pernah memilih: ikuti bahasa HP. Selain bahasa Indonesia/Melayu dianggap Inggris.
  const nav = (navigator.languages?.[0] ?? navigator.language ?? "id").toLowerCase();
  return nav.startsWith("id") || nav.startsWith("ms") ? "id" : "en";
}

const listeners = new Set<(l: Lang) => void>();
let current: Lang | null = null;

/** Bahasa halaman pelanggan, tersimpan di HP pembeli dan sama di semua tab. */
export function useLang() {
  const [lang, setLangState] = useState<Lang>(() => (current ??= initialLang()));
  useEffect(() => {
    listeners.add(setLangState);
    document.documentElement.lang = lang;
    return () => {
      listeners.delete(setLangState);
    };
  }, [lang]);
  const setLang = (l: Lang) => {
    current = l;
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* abaikan */
    }
    document.documentElement.lang = l;
    listeners.forEach((fn) => fn(l));
  };
  return { lang, setLang, t: DICT[lang] };
}

export function LangSwitch({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="lang-switch" role="group" aria-label={DICT[lang].language}>
      <Languages aria-hidden="true" />
      <button type="button" aria-pressed={lang === "id"} onClick={() => setLang("id")} lang="id" title="Bahasa Indonesia">
        ID
      </button>
      <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")} lang="en" title="English">
        EN
      </button>
    </div>
  );
}
