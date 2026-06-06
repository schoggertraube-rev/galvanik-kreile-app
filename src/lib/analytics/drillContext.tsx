"use client";

/**
 * Drill Context — state management for the AnalyticsDrillDrawer.
 * Syncs kpiId + period with URL search params for deep-linking.
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { PeriodType } from "./plainLanguage";

interface DrillState {
  kpiId: string | null;
  period: PeriodType;
  isOpen: boolean;
  openDrill: (kpiId: string, period?: PeriodType) => void;
  closeDrill: () => void;
  setPeriod: (p: PeriodType) => void;
}

const DrillContext = createContext<DrillState>({
  kpiId: null,
  period: "monat",
  isOpen: false,
  openDrill: () => {},
  closeDrill: () => {},
  setPeriod: () => {},
});

export function useDrill(): DrillState {
  return useContext(DrillContext);
}

export function DrillProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Initialize from URL params
  const urlDrill = searchParams.get("drill");
  const urlPeriod = searchParams.get("period") as PeriodType | null;

  const [kpiId, setKpiId] = useState<string | null>(urlDrill);
  const [period, setPeriodState] = useState<PeriodType>(urlPeriod || "monat");

  // Sync URL → state on mount
  useEffect(() => {
    if (urlDrill && urlDrill !== kpiId) {
      setKpiId(urlDrill);
    }
    if (urlPeriod && urlPeriod !== period) {
      setPeriodState(urlPeriod);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlDrill, urlPeriod]);

  const updateUrl = useCallback(
    (newKpiId: string | null, newPeriod: PeriodType) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newKpiId) {
        params.set("drill", newKpiId);
        params.set("period", newPeriod);
      } else {
        params.delete("drill");
        params.delete("period");
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const openDrill = useCallback(
    (id: string, p?: PeriodType) => {
      const newPeriod = p || period;
      setKpiId(id);
      setPeriodState(newPeriod);
      updateUrl(id, newPeriod);
    },
    [period, updateUrl],
  );

  const closeDrill = useCallback(() => {
    setKpiId(null);
    updateUrl(null, period);
  }, [period, updateUrl]);

  const setPeriod = useCallback(
    (p: PeriodType) => {
      setPeriodState(p);
      if (kpiId) {
        updateUrl(kpiId, p);
      }
    },
    [kpiId, updateUrl],
  );

  return (
    <DrillContext.Provider
      value={{
        kpiId,
        period,
        isOpen: kpiId !== null,
        openDrill,
        closeDrill,
        setPeriod,
      }}
    >
      {children}
    </DrillContext.Provider>
  );
}
