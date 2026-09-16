export type QuoteCommandCapabilities = {
  canCreateQuote: boolean;
  canReadQuote: boolean;
  canUpdateQuote: boolean;
  canConvertQuote: boolean;
};

export type QuoteCommandContext = {
  tenantId: string;
  userId: string;
  capabilities: QuoteCommandCapabilities;
};

export type QuotePositionInput = {
  name: string;
  quantity: number;
  material: string | null;
  surfaceRequested: string;
  unitPriceCents: number;
};

export type CreateQuoteInput = {
  clientEventId: string;
  customerId: string;
  dueDate: string;
  note: string | null;
  positions: QuotePositionInput[];
};

export type ConvertQuoteInput = {
  quoteId: string;
  clientEventId: string;
  expectedVersion: number;
  confirmedAward: true;
  /** The order promise is intentionally distinct from the customer's KV wish date. */
  confirmedOrderDueDate: string;
};

export type UpdateQuoteInput = {
  quoteId: string;
  clientEventId: string;
  expectedVersion: number;
  dueDate: string;
  note: string | null;
  positions: QuotePositionInput[];
};

export type QuotePosition = QuotePositionInput & {
  id: string;
  position: number;
  lineTotalCents: number;
};

export type QuoteReadback = {
  quoteId: string;
  quoteNumber: string;
  customerId: string;
  customerNumber: string | null;
  customerDisplayName: string;
  status: "draft" | "converted";
  version: number;
  currency: "EUR";
  dueDate: string;
  note: string | null;
  totalNetCents: number;
  linkedOrderId: string | null;
  actorId: string;
  actorDisplayName: string;
  createdAt: string;
  updatedAt: string;
  convertedAt: string | null;
  positions: QuotePosition[];
};

export type QuoteUpdateReceipt = {
  receiptId: string;
  eventId: string;
  quoteId: string;
  actorId: string;
  clientEventId: string;
  correlationId: string;
  recordedAt: string;
  expectedVersion: number;
  aggregateVersion: number;
};

export type QuoteCreateReceipt = {
  receiptId: string;
  eventId: string;
  quoteId: string;
  customerId: string;
  actorId: string;
  clientEventId: string;
  correlationId: string;
  recordedAt: string;
  aggregateVersion: 1;
};

export type QuoteConversionReceipt = {
  receiptId: string;
  eventId: string;
  quoteId: string;
  customerId: string;
  orderId: string;
  orderIntakeEventId: string;
  actorId: string;
  clientEventId: string;
  correlationId: string;
  recordedAt: string;
  aggregateVersion: number;
};

export type QuoteCommandFailure = {
  code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR" | "UNAVAILABLE";
  message: string;
};

export type CreateQuoteResult =
  | { code: "OK"; quote: QuoteReadback; receipt: QuoteCreateReceipt; replayed: boolean }
  | QuoteCommandFailure;

export type ReadQuoteResult =
  | { code: "OK"; quote: QuoteReadback }
  | QuoteCommandFailure;

export type UpdateQuoteResult =
  | { code: "OK"; quote: QuoteReadback; receipt: QuoteUpdateReceipt; replayed: boolean }
  | QuoteCommandFailure;

export type ListOpenQuotesResult =
  | { code: "OK"; quotes: QuoteReadback[] }
  | QuoteCommandFailure;

export type ReadQuoteCreateReceiptResult =
  | { code: "OK"; quote: QuoteReadback; receipt: QuoteCreateReceipt }
  | QuoteCommandFailure;

export type ReadQuoteUpdateReceiptResult =
  | { code: "OK"; quote: QuoteReadback; receipt: QuoteUpdateReceipt }
  | QuoteCommandFailure;

export type QuoteOrderInput = {
  clientEventId: string;
  customer: { mode: "EXISTING"; customerId: string };
  dueDate: string;
  note: string | null;
  items: Array<{
    name: string;
    quantity: number;
    material: string | null;
    surfaceRequested: string;
  }>;
};

export type PrepareQuoteConversionResult =
  | { code: "OK"; quoteId: string; orderInput: QuoteOrderInput; replayed: boolean }
  | QuoteCommandFailure;

export type ReadQuoteConversionReceiptResult =
  | { code: "OK"; receipt: QuoteConversionReceipt; quote: QuoteReadback }
  | QuoteCommandFailure;
