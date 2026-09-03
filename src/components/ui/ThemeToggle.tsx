"use client";

import { useState, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const subscribeToNothing = () => () => {};
const getClientMountState = () => true;
const getServerMountState = () => false;

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("kreile-theme") === "dark" ? "dark" : "light";
  });
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    getClientMountState,
    getServerMountState,
  );

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("kreile-theme", nextTheme);
    
    const root = document.documentElement;
    if (nextTheme === "dark") {
      root.classList.add("dark", "theme-dark");
      root.classList.remove("theme-light");
    } else {
      root.classList.add("theme-light");
      root.classList.remove("dark", "theme-dark");
    }
  };

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        className="flex items-center justify-center gap-2 px-3 xl:px-4 py-2 w-12 xl:w-auto h-12 min-w-[48px] min-h-[48px] shrink-0 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--ink)] transition-colors opacity-50 font-bold text-sm"
        aria-label="Lade Theme..."
      >
        <Sun className="w-4 h-4 shrink-0" />
        <span className="hidden xl:inline">Hell / Dunkel</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex items-center justify-center gap-2 px-3 xl:px-4 py-2 w-12 xl:w-auto h-12 min-w-[48px] min-h-[48px] shrink-0 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--ink)] transition-colors font-bold text-sm"
      aria-label={`Aktuelles Theme: ${theme === 'light' ? 'Hell' : 'Dunkel'}. Klicken zum Umschalten.`}
    >
      {theme === "light" ? <Moon className="w-4 h-4 shrink-0" /> : <Sun className="w-4 h-4 shrink-0" />}
      <span className="hidden xl:inline whitespace-nowrap">{theme === "light" ? "Design: Dunkel" : "Design: Hell"}</span>
    </button>
  );
}
