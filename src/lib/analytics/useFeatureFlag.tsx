"use client";

/**
 * Professional Feature Flag System
 *
 * 3-level resolution:
 *   1. localStorage override (Admin-UI / developer toggle)
 *   2. Compile-time defaults (FLAG_DEFS below)
 *   3. Future: Supabase `feature_flags` table (remote config)
 *
 * SSR-safe: always returns default on server, hydrates on client.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ── Flag Definitions ──────────────────────────────────────────────────

export interface FlagDef {
  name: string;
  description: string;
  default: boolean;
  category: "analytics" | "ui" | "experimental";
}

export const FLAG_DEFS: FlagDef[] = [
  {
    name: "analyticsDrawer",
    description: "Ersetzt Detail-Overlays durch den neuen Analytics-Drill-Drawer mit echten Daten, Charts und Cross-KPI-Analyse.",
    default: true,
    category: "analytics",
  },
  {
    name: "insightRules",
    description: "Zeigt regelbasierte Insights (Sektion E) im Drill-Drawer. Ohne Flag: Platzhalter.",
    default: false,
    category: "analytics",
  },
  {
    name: "insightLlm",
    description: "Aktiviert KI-generierte Insights via Claude (Bedrock). Nur aggregierte Daten, keine Klarnamen.",
    default: false,
    category: "experimental",
  },
];

const STORAGE_KEY = "kreile_feature_flags_v2";

// ── Storage helpers ───────────────────────────────────────────────────

function readOverrides(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeOverrides(overrides: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

function resolveFlag(name: string, overrides: Record<string, boolean>): boolean {
  // 1. localStorage override
  if (name in overrides) return overrides[name];
  // 2. Compile-time default
  const def = FLAG_DEFS.find((f) => f.name === name);
  return def?.default ?? false;
}

// ── Context ───────────────────────────────────────────────────────────

interface FlagContextValue {
  flags: Record<string, boolean>;
  overrides: Record<string, boolean>;
  setOverride: (name: string, value: boolean) => void;
  removeOverride: (name: string) => void;
  resetAll: () => void;
}

const FlagContext = createContext<FlagContextValue>({
  flags: {},
  overrides: {},
  setOverride: () => {},
  removeOverride: () => {},
  resetAll: () => {},
});

// ── Provider ──────────────────────────────────────────────────────────

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverridesState] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setOverridesState(readOverrides());
    setHydrated(true);
  }, []);

  // Resolve all flags
  const flags: Record<string, boolean> = {};
  for (const def of FLAG_DEFS) {
    flags[def.name] = hydrated ? resolveFlag(def.name, overrides) : def.default;
  }

  const setOverride = useCallback((name: string, value: boolean) => {
    setOverridesState((prev) => {
      const next = { ...prev, [name]: value };
      writeOverrides(next);
      return next;
    });
  }, []);

  const removeOverride = useCallback((name: string) => {
    setOverridesState((prev) => {
      const next = { ...prev };
      delete next[name];
      writeOverrides(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setOverridesState({});
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return (
    <FlagContext.Provider value={{ flags, overrides, setOverride, removeOverride, resetAll }}>
      {children}
    </FlagContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useFeatureFlag(name: string): boolean {
  const { flags } = useContext(FlagContext);
  if (name in flags) return flags[name];
  // Fallback for components outside provider
  const def = FLAG_DEFS.find((f) => f.name === name);
  return def?.default ?? false;
}

/**
 * Hook to access the full feature flag admin API.
 * Use in admin/settings pages.
 */
export function useFeatureFlagAdmin() {
  return useContext(FlagContext);
}
