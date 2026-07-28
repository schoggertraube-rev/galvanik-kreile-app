import { useMemo } from "react";

export interface GlobalSearchResult {
  typ: "auftrag" | "kunde" | "teil" | "kpi";
  id: string;
  label: string;
  sublabel: string;
}

/**
 * A browser RPC cannot establish tenant ownership, evidence, or an RLS proof.
 * Keep the legacy hook explicit about that rather than returning a synthetic
 * empty search result that looks like a genuine miss.
 */
export function useGlobalSearch(_query: string) {
  return useMemo(() => ({
    data: [] as GlobalSearchResult[],
    isLoading: false,
    error: new Error("NOT_CONFIGURED: Globale Suche benötigt einen geprüften Serververtrag."),
  }), []);
}
