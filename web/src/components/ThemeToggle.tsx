import { useState } from "react";
import { MonitorSmartphone, Moon, Sun } from "lucide-react";
import { getThemePref, setThemePref, type ThemePref } from "../lib/theme";

export function ThemeToggle({ className = "nav-link", asSheet }: { className?: string; asSheet?: boolean }) {
  const [pref, setPref] = useState<ThemePref>(getThemePref());
  const next: ThemePref = pref === "system" ? "dark" : pref === "dark" ? "light" : "system";
  const label = pref === "system" ? "Tema: ikut perangkat" : pref === "dark" ? "Tema: gelap" : "Tema: terang";
  const Icon = pref === "system" ? MonitorSmartphone : pref === "dark" ? Moon : Sun;
  return (
    <button
      type="button"
      className={asSheet ? undefined : className}
      style={asSheet ? undefined : { border: 0, background: "none", cursor: "pointer", width: "100%" }}
      onClick={() => {
        setThemePref(next);
        setPref(next);
      }}
      aria-label={`${label}. Ketuk untuk ganti.`}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

