"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PeriodType } from "./plainLanguage";

interface DrillState {
  kpiId: string | null;
  period: PeriodType;
  isOpen: boolean;
  openDrill: (kpiId: string, period?: PeriodType) => void;
  closeDrill: () => void;
  setPeriod: (period: PeriodType) => void;
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

/** The URL is the sole drill state; no effect mirrors query params into React state. */
export function DrillProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const kpiId = searchParams.get("drill");
  const period = (searchParams.get("period") as PeriodType | null) || "monat";

  const updateUrl = useCallback((nextKpiId: string | null, nextPeriod: PeriodType) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextKpiId) {
      params.set("drill", nextKpiId);
      params.set("period", nextPeriod);
    } else {
      params.delete("drill");
      params.delete("period");
    }
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const openDrill = useCallback((id: string, requestedPeriod?: PeriodType) => {
    updateUrl(id, requestedPeriod || period);
  }, [period, updateUrl]);

  const closeDrill = useCallback(() => {
    updateUrl(null, period);
  }, [period, updateUrl]);

  const setPeriod = useCallback((requestedPeriod: PeriodType) => {
    if (kpiId) updateUrl(kpiId, requestedPeriod);
  }, [kpiId, updateUrl]);

  return (
    <DrillContext.Provider value={{ kpiId, period, isOpen: kpiId !== null, openDrill, closeDrill, setPeriod }}>
      {children}
    </DrillContext.Provider>
  );
}
