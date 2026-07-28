export interface KachelDaten {
  trend?: { prozent: number; positivIstGut: boolean };
  [key: string]: unknown;
}

export interface InsightAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface Insight {
  beobachtungen: string[];
  vermutungen: string[];
  vorschlaege: InsightAction[];
}

/**
 * Financial/marketing conclusion generation is unavailable until each metric
 * has a checked evidence, scope and finance-owner contract. Returning an
 * explicit state prevents fabricated observations from legacy heuristics.
 */
export function generateInsight(_kachel: string, _daten: KachelDaten): Insight {
  void _kachel;
  void _daten;
  return {
    beobachtungen: ["NOT_CONFIGURED: Für diese Aussage liegt noch kein freigegebener Nachweisvertrag vor."],
    vermutungen: [],
    vorschlaege: [],
  };
}
