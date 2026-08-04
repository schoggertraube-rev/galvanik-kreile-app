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
  useCallback,
  useSyncExternalStore,
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
const STORAGE_EVENT = "kreile-feature-flags-change";
const EMPTY_OVERRIDES: Record<string, boolean> = {};
let cachedOverridesRaw: string | null | undefined;
let cachedOverrides: Record<string, boolean> = EMPTY_OVERRIDES;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ── Storage helpers ───────────────────────────────────────────────────

function readOverrides(): Record<string, boolean> {
  if (typeof window === "undefined") return EMPTY_OVERRIDES;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedOverridesRaw) return cachedOverrides;

  cachedOverridesRaw = raw;
  if (!raw) {
    cachedOverrides = EMPTY_OVERRIDES;
    return cachedOverrides;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      cachedOverrides = EMPTY_OVERRIDES;
      return cachedOverrides;
    }

    cachedOverrides = Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
    );
    return cachedOverrides;
  } catch {
    cachedOverrides = EMPTY_OVERRIDES;
    return cachedOverrides;
  }
}

function writeOverrides(overrides: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(overrides);
  cachedOverridesRaw = raw;
  cachedOverrides = overrides;
  localStorage.setItem(STORAGE_KEY, raw);
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function subscribeToOverrides(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onStoreChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(STORAGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(STORAGE_EVENT, onStoreChange);
  };
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
  const overrides = useSyncExternalStore(subscribeToOverrides, readOverrides, () => EMPTY_OVERRIDES);

  // Resolve all flags
  const flags: Record<string, boolean> = {};
  for (const def of FLAG_DEFS) {
    flags[def.name] = resolveFlag(def.name, overrides);
  }

  const setOverride = useCallback((name: string, value: boolean) => {
    writeOverrides({ ...readOverrides(), [name]: value });
  }, []);

  const removeOverride = useCallback((name: string) => {
    const next = { ...readOverrides() };
    delete next[name];
    writeOverrides(next);
  }, []);

  const resetAll = useCallback(() => {
    if (typeof window !== "undefined") {
      cachedOverridesRaw = null;
      cachedOverrides = EMPTY_OVERRIDES;
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event(STORAGE_EVENT));
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
