import type {CaseActorTrace} from "@/lib/domain/caseActorContract";
import type {QuoteCalculation} from "../quoteCalculation";
export type QuoteCommandCapabilities = {
  canDecideQuote?:boolean;
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
  unit?: string | null;
  plannedMinutes?: number | null;
  name: string;
  quantity: number;
  material: string | null;
  surfaceRequested: string;
  unitPriceCents: number;
  /** Exact total for calculations that cannot be divided into integer unit cents. */
  lineTotalCents?: number;
};

export type CreateQuoteInput = {
  sourceComplaintId?:string;
  clientEventId: string;
  customerId: string;
  dueDate: string;
  note: string | null;
  positions: QuotePositionInput[];
  validUntil?: string | null;
  termStatus?: "wunsch" | "bestaetigt" | "verschoben" | "gegenvorschlag" | null;
  intakeSource?: "persoenlich" | "versand" | "abholung_firma" | "anfrage_mail" | "anfrage_telefon" | null;
  calculation?:QuoteCalculation;
  source?: {itemId:string;version:number;message:boolean};
  specialRequests?:string|null;
  deliveryWeeks?:number|null;
};

export type ConvertQuoteInput = {
  quoteId: string;
  clientEventId: string;
  expectedVersion: number;
  confirmedAward: true;
  goodsReceiptId?:string;
  /** The order promise is intentionally distinct from the customer's KV wish date. */
  confirmedOrderDueDate: string;
  handoverMode: "pickup" | "shipping";
  paymentMode: "vorkasse" | "abholung" | "rechnung";
};

export type UpdateQuoteInput = {
  source?:CreateQuoteInput['source'];
  termStatus?:CreateQuoteInput['termStatus'];
  calculation?:QuoteCalculation;
  quoteId: string;
  clientEventId: string;
  expectedVersion: number;
  dueDate: string;
  note: string | null;
  positions: QuotePositionInput[];
};

export type QuotePosition = QuotePositionInput & {
  vatRateBasisPoints?: 0 | 700 | 1900 | null;
  id: string;
  position: number;
  lineTotalCents: number;
};

export type QuoteReadback = {
  actorTrace?:CaseActorTrace;
  actorReadError?:string;
  sourceComplaintId?:string;
  lifecycle?: {
    edition:number; stage:'entwurf'|'versendet'|'geaendert_seit_versand'|'zugesagt'|'umgewandelt'|'abgesagt'|'abgelaufen';
    sentEdition:number|null; sentAt:string|null; sentChannel:'mail'|'druck'|null;
    acceptedEdition:number|null; acceptedAt:string|null; acceptanceEvidence:string|null;
    conditional?:{edition:number;recordedAt:string;reason:string}|null;
    calculation?:QuoteCalculation|null;
    goods?:Array<{id:string;orderId:string|null;edition:number;location:string;blocked:boolean;version:number;packagesReceived?:number|null;packagesTotal?:number|null;condition?:string|null;deviations?:string[];clearance?:{reason:string;actorId:string;at:string}|null;expectedPositions?:Array<{position:number;quantity:number}>}>;
    declinedAt:string|null; declineReason:string|null; followupAt:string|null;
    sourceItemId:string|null; sourceMessageId:string|null; specialRequests:string|null;deliveryWeeks:number|null;
  };
  quoteId: string;
  quoteNumber: string;
  customerId: string;
  customerNumber: string | null;
  customerDisplayName: string;
  status: "draft" | "converted";
  version: number;
  currency: "EUR";
  dueDate: string;
  validUntil: string | null;
  termStatus: "wunsch" | "bestaetigt" | "verschoben" | "gegenvorschlag" | null;
  intakeSource: "persoenlich" | "versand" | "abholung_firma" | "anfrage_mail" | "anfrage_telefon" | null;
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
  geprueft: boolean;
  clientEventId: string;
  customer: { mode: "EXISTING"; customerId: string };
  dueDate: string;
  termStatus: "wunsch" | "bestaetigt" | "verschoben" | "gegenvorschlag" | null;
  intakeSource: "persoenlich" | "versand" | "abholung_firma" | "anfrage_mail" | "anfrage_telefon" | null;
  handoverMode: "pickup" | "shipping";
  paymentMode: "vorkasse" | "abholung" | "rechnung";
  note: string | null;
  items: Array<{
    catalogServiceId: null;
    name: string;
    quantity: number;
    material: string | null;
    surfaceRequested: string;
    unit: null;
    unitPriceCents: null;
    vatRateBasisPoints: null;
  }>;
};

export type PrepareQuoteConversionResult =
  | { code: "OK"; quoteId: string; orderInput: QuoteOrderInput; replayed: boolean }
  | QuoteCommandFailure;

export type ReadQuoteConversionReceiptResult =
  | { code: "OK"; receipt: QuoteConversionReceipt; quote: QuoteReadback }
  | QuoteCommandFailure;
