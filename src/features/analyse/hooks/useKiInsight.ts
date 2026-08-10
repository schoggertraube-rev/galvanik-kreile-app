type KiInsight = { beobachtung: string; achtung?: string; empfehlung: string };

export function useKiInsight(_kachel: string, _daten: Record<string, number | string | null>) {
  void _kachel;
  void _daten;
  return { data: undefined as KiInsight | undefined, isLoading: false, error: new Error("NOT_AVAILABLE: KI-Einschätzungen benötigen eine kanonische Datenquelle.") };
}
