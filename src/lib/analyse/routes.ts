import { parseSafeInternalPath } from "@/lib/navigation/safeReturnTo";
import {
  ANALYSE_TILE_KEYS,
  type AnalyseEntityLink,
  type AnalyseTileKey,
} from "./dataContracts";

export const ANALYSE_PERIODS = ["Heute", "Woche", "Monat"] as const;
export type AnalysePeriod = (typeof ANALYSE_PERIODS)[number];
type SearchParamValue = string | string[] | undefined;

function firstValue(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? undefined : value;
}

export function parseAnalysePeriod(value: SearchParamValue): AnalysePeriod {
  const candidate = firstValue(value);
  return ANALYSE_PERIODS.find((period) => period === candidate) ?? "Monat";
}

export function parseAnalyseTile(value: SearchParamValue): AnalyseTileKey | null {
  const candidate = firstValue(value);
  return ANALYSE_TILE_KEYS.find((tile) => tile === candidate) ?? null;
}

// URL builder for returns
export function getAnalyseReturnTo(tileKey: AnalyseTileKey, period: AnalysePeriod): string {
  const searchParams = new URLSearchParams();
  searchParams.set("tile", tileKey);
  searchParams.set("period", period);
  return `/performance?${searchParams.toString()}`;
}

// Logic to open entities (could just return URLs or trigger overlay actions)
// Since we use global overlays often, we can return the href for standard links,
// or indicate what global action to trigger.
export function openAnalyseEntityLink(link: AnalyseEntityLink): string | null {
  if (link.overlay === "customer") {
    return `/customers/${encodeURIComponent(link.id)}`;
  }
  if (link.overlay === "order") {
    return `/orders/${encodeURIComponent(link.id)}`;
  }
  if (link.href) {
    return parseSafeInternalPath(link.href);
  }
  return null;
}
