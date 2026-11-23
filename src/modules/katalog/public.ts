export type CatalogService = {
  id: string;
  name: string;
  surface: string;
  unit: string;
  netPriceCents: number;
  vatRateBasisPoints: number;
  standardLeadTimeWorkingDays: number | null;
  active: boolean;
};

export type SaveCatalogServiceInput = Omit<CatalogService, "id"> & { id: string | null };

// Der bestehende Auftragsweg und das Rechnungsoriginal haben einen engeren Vertrag.
export const AUFTRAGS_KATALOG_STEUERSAETZE = [0, 700, 1900] as const;
export type AuftragsKatalogSteuersatz = typeof AUFTRAGS_KATALOG_STEUERSAETZE[number];

/** The same catalog entry, with monetary fields absent when they are not allowed. */
export type CatalogServiceChoice = Omit<CatalogService, "netPriceCents" | "vatRateBasisPoints"> & {
  netPriceCents?: number;
  vatRateBasisPoints?: AuftragsKatalogSteuersatz;
};
