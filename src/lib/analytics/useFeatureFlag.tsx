"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface FlagDef {
  name: string;
  description: string;
  default: boolean;
  category: "analytics" | "ui" | "experimental";
}

/** Browser-side overrides cannot revive a quarantined product capability. */
export const FLAG_DEFS: readonly FlagDef[] = [
  { name: "analyticsDrawer", description: "Analytics-Drill benötigt einen Daten- und Rollenvertrag.", default: false, category: "analytics" },
  { name: "insightRules", description: "Regelbasierte Insights benötigen belegte Eingangsdaten.", default: false, category: "analytics" },
  { name: "insightLlm", description: "KI-Insights bleiben ohne KI-Vertrag gesperrt.", default: false, category: "experimental" },
];

interface FlagContextValue {
  flags: Record<string, boolean>;
  overrides: Record<string, boolean>;
  setOverride: (name: string, value: boolean) => never;
  removeOverride: (name: string) => never;
  resetAll: () => void;
}

const flags = Object.freeze(Object.fromEntries(FLAG_DEFS.map((definition) => [definition.name, false]))) as Record<string, boolean>;

const unavailable = (): never => {
  throw new Error("NOT_CONFIGURED: Client-seitige Feature-Overrides sind gesperrt.");
};

const FlagContext = createContext<FlagContextValue>({
  flags,
  overrides: {},
  setOverride: unavailable,
  removeOverride: unavailable,
  resetAll: () => {},
});

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  return (
    <FlagContext.Provider value={{ flags, overrides: {}, setOverride: unavailable, removeOverride: unavailable, resetAll: () => {} }}>
      {children}
    </FlagContext.Provider>
  );
}

export function useFeatureFlag(name: string): boolean {
  return useContext(FlagContext).flags[name] === true;
}

export function useFeatureFlagAdmin() {
  return useContext(FlagContext);
}
