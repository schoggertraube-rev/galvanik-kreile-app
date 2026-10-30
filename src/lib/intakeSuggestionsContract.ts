export type IntakeSuggestionPositionInput = {
  key: string;
  catalogServiceId: string | null;
  name: string;
  quantity: number;
  surfaceRequested: string;
  unit: string | null;
  unitPriceCents: number | null;
};

export type IntakeSuggestionsInput = {
  customerId: string | null;
  kind: "ORDER" | "QUOTE";
  wishDate: string | null;
  positions: IntakeSuggestionPositionInput[];
};

export type IntakeTermSuggestion = {
  achievableDate: string;
  wishDate: string | null;
  rating: "passt" | "knapp" | "nicht_machbar" | null;
  bufferWorkingDays: number | null;
  reasons: Array<{ kind: "lead" | "effort"; text: string }>;
};

export type IntakePriceCase = {
  kind: "gleich" | "aehnlich" | "katalog";
  customerName: string;
  partName: string;
  surface: string;
  quantity: number | null;
  invoiceDate: string | null;
  unitPriceCents: number;
};

export type IntakePriceSuggestion = {
  positionKey: string;
  source: "gleich" | "aehnlich" | "katalog";
  unit: string;
  unitPriceCents: number;
  lineTotalCents: number;
  caseCount: number;
  cases: IntakePriceCase[];
};

export type IntakeSuggestions = {
  term: IntakeTermSuggestion | null;
  prices: IntakePriceSuggestion[];
};
