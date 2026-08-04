import { AnalyseEntityLink, AnalyseTileKey } from "./dataContracts";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

// URL builder for returns
export function getAnalyseReturnTo(tileKey: AnalyseTileKey, period: string, filters?: Record<string, JsonValue>): string {
  const searchParams = new URLSearchParams();
  searchParams.set("tile", tileKey);
  searchParams.set("period", period);
  if (filters) {
    searchParams.set("filters", JSON.stringify(filters));
  }
  return `/performance?${searchParams.toString()}`;
}

// Logic to open entities (could just return URLs or trigger overlay actions)
// Since we use global overlays often, we can return the href for standard links,
// or indicate what global action to trigger.
export function openAnalyseEntityLink(link: AnalyseEntityLink) {
  if (link.overlay === "customer") {
    // Return a special token or trigger global store. For now, just return route if possible.
    return `/customers/${link.id}`;
  }
  if (link.overlay === "order") {
    return `/orders/${link.id}`;
  }
  if (link.href) {
    return link.href;
  }
  return "#";
}
