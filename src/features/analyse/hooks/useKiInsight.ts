import { useMemo } from "react";

/**
 * The legacy hook called an Edge Function directly from the browser.  It stays
 * explicitly unavailable until its input, tenant scope, provider receipt, and
 * evidence links are served by an audited server contract.
 */
export function useKiInsight(_kachel: string, _daten: Record<string, number | string | null>) {
  return useMemo(() => ({
    data: undefined as { beobachtung: string; achtung?: string; empfehlung: string } | undefined,
    isLoading: false,
    error: new Error("NOT_CONFIGURED: KI-Hinweise sind noch nicht freigegeben."),
  }), []);
}
