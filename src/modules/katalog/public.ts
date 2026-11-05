export type CatalogService = {
  id: string;
  name: string;
  surface: string;
  unit: string;
  netPriceCents: number;
  vatRateBasisPoints: 0 | 700 | 1900;
  standardLeadTimeWorkingDays: number;
  active: boolean;
};

export type SaveCatalogServiceInput = Omit<CatalogService, "id"> & { id: string | null };

/** The same catalog entry, with monetary fields absent when they are not allowed. */
export type CatalogServiceChoice = Omit<CatalogService, "netPriceCents" | "vatRateBasisPoints"> &
  Partial<Pick<CatalogService, "netPriceCents" | "vatRateBasisPoints">>;
