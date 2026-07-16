export interface CustomerKpi {
  customer_id: string;
  kunde: string;
  classification: string;
  kunde_seit: string;
  umsatz_ltv: number;
  gewinn_ltv: number;
  offene_posten: number;
  aktive_auftraege: number;
  puenktlichkeit_pct: number | null;
  reklamationen: number;
}

