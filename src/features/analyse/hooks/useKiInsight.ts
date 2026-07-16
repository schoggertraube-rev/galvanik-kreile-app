export type KiInsight = { beobachtung: string; achtung?: string; empfehlung: string };

/** @deprecated The legacy tile has no approved, receipt-backed AI adapter. */
export function useKiInsight(kachel: string, daten: Record<string, number | string | null>) {
  void kachel;
  void daten;
  return {
    data: undefined as KiInsight | undefined,
    isLoading: false,
    error: new Error("KI-Erkenntnis nicht verfügbar: kein freigegebener Serveradapter."),
  };
}
