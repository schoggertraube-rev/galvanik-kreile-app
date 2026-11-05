export const INTAKE_TERM_ORIGINS=["wunsch_passt","wunsch_knapp","ueber_auslastung","vorschlag","gegenvorschlag","wunsch_kv"] as const;
export type IntakeTermOrigin=typeof INTAKE_TERM_ORIGINS[number];
export const INTAKE_PROCESSING_WEEKS=[1,2,3,5] as const;

export type IntakeSuggestionPositionInput = {
  key: string;
  catalogServiceId: string | null;
  name: string;
  quantity: number;
  surfaceRequested: string;
  unit: string | null;
  unitPriceCents: number | null;
  effortMinutes?: number | null;
};

export type IntakeSuggestionsInput = {
  customerId: string | null;
  kind: "ORDER" | "QUOTE";
  wishDate: string | null;
  positions: IntakeSuggestionPositionInput[];
  handoverMode?: "pickup" | "shipping" | null;
  processingWeeks?: 1 | 2 | 3 | 5 | null;
};

export type IntakeTermSuggestion = {
  achievableDate: string | null;
  wishDate: string | null;
  rating: "passt" | "knapp" | "nicht_machbar" | "unmoeglich" | null;
  bufferWorkingDays: number | null;
  reasons: Array<{ kind: "lead" | "effort" | "capacity" | "calendar"; text: string }>;
  estimatedWeeks?: number;
  proposals?: Array<{id:"schnell"|"empfohlen"|"entspannt";title:string;date:string;utilization:number;rating:"Luft"|"voll"}>;
  offerDate?: string | null;
  unavailableReason?: string;
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
  unit: string | null;
  unitPriceCents: number;
  lineTotalCents: number;
  caseCount: number;
  cases: IntakePriceCase[];
};

export type IntakeSuggestions = {
  term: IntakeTermSuggestion | null;
  prices: IntakePriceSuggestion[];
};
