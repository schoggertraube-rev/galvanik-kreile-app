"use client";
// src/hooks/useFeatureFlag.ts
// Einziger Zugriffspunkt für UI-Komponenten — kein direktes Tier-Checking im JSX
import { createContext, useContext, useMemo, ReactNode, createElement } from "react";
import type { FeatureFlag, FeatureKey, LicensePlan } from "@/lib/license/types";
import { resolveFeatures } from "@/lib/license/resolveFeatures";
import type { DataReadiness } from "@/lib/license/types";

// Default plan: Premium (alle Features aktiv für Kreile)
const DEFAULT_PLAN: LicensePlan = "premium";

type LicenseContextValue = {
  plan: any; // Bypass TS check for legacy UI components since LicensePlan is now a string union
  flags: Record<FeatureKey, any>;
  getFlag: (key: FeatureKey) => FeatureFlag | undefined;
};

const LicenseContext = createContext<LicenseContextValue | null>(null);

export function LicenseProvider({
  plan = DEFAULT_PLAN,
  readiness = {} as Record<FeatureKey, DataReadiness>,
  children,
}: {
  plan?: LicensePlan;
  readiness?: Record<FeatureKey, DataReadiness>;
  children: ReactNode;
}) {
  const flags = useMemo(() => resolveFeatures(plan, readiness), [plan, readiness]);
  const getFlag = (key: FeatureKey): FeatureFlag | undefined => {
    const f = flags[key];
    if (!f) return undefined;
    return {
      enabled: f.available,
      dataReadinessState: f.lockReason === "datenreife" ? "thin" : "reliable",
      hintLong: f.lockReason === "plan" ? "Im Plan nicht enthalten" : undefined,
      hintShort: f.lockReason === "datenreife" ? "Daten unzureichend" : undefined
    };
  };

  return createElement(LicenseContext.Provider, { value: { plan, flags, getFlag } }, children);
}

export function useLicenseContext() {
  const ctx = useContext(LicenseContext);
  if (!ctx) {
    // Return default (all enabled) when provider not mounted
    const flags = resolveFeatures(DEFAULT_PLAN, {} as Record<FeatureKey, DataReadiness>);
    return {
      plan: DEFAULT_PLAN,
      flags,
      getFlag: (key: FeatureKey): FeatureFlag | undefined => {
        const f = flags[key];
        if (!f) return undefined;
        return {
          enabled: f.available,
          dataReadinessState: f.lockReason === "datenreife" ? "thin" : "reliable",
          hintLong: f.lockReason === "plan" ? "Im Plan nicht enthalten" : undefined,
          hintShort: f.lockReason === "datenreife" ? "Daten unzureichend" : undefined
        };
      },
    };
  }
  return ctx;
}

export function useFeatureFlag(key: FeatureKey): FeatureFlag {
  const { getFlag } = useLicenseContext();
  const flag = getFlag(key);
  if (!flag) {
    return {
      enabled: true,
      dataReadinessState: "reliable",
      hintShort: "Aktiv",
      hintLong: "Funktion verfügbar",
    };
  }
  return flag;
}
