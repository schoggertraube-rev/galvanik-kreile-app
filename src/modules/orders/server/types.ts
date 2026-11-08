import type { CustomerAgreementRecord } from "@/modules/customers/public";

export type OrderCardGoodsOutMode = "versand" | "abholung";
export type OrderCardGoodsOutAgreement = Pick<
  CustomerAgreementRecord,
  "id" | "type" | "targetDays" | "version"
>;

function berlinCollectionMonth() {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

/**
 * The goods-out wording is shared by the 10.1 surface and its confirmed
 * receipt.  It derives solely from the typed agreement returned by the
 * canonical order-card reader; it never infers a payment arrangement.
 */
export function goodsOutAgreementButtonText(
  agreement: OrderCardGoodsOutAgreement,
  mode: OrderCardGoodsOutMode,
) {
  const prefix = mode === "versand" ? "Versendet" : "Übergeben";
  if (agreement.type === "sammelrechnung") {
    return `${prefix} · Sammelrechnung ${berlinCollectionMonth()}`;
  }
  if (agreement.type === "zahlungsziel") {
    return agreement.targetDays === null
      ? `${prefix} · Rechnung folgt · Zahlungsziel fehlt`
      : `${prefix} · Rechnung folgt · Ziel ${agreement.targetDays} Tage`;
  }
  return `${prefix} · Rechnung folgt`;
}

export function goodsOutAgreementReceiptText(
  agreement: OrderCardGoodsOutAgreement,
  mode: OrderCardGoodsOutMode,
) {
  return goodsOutAgreementButtonText(agreement, mode)
    .replace(/^Übergeben · /, "")
    .replace(/^Versendet · /, "Versendet · ");
}

export type OrdersListItem = {
  id: string;
  orderNumber: string;
  customerName: string;
  title: string;
  station: string;
  status: string;
  dueAt: string | null;
  material: string | null;
  surface: string | null;
  risk: string;
};
export type OrderCardExtraWork = {
  lineId: string;
  name: string;
  minutes: number;
  amountCents: number | null;
  frozen: boolean;
};
export type OrderCardItem = {
  id: string;
  position: number;
  name: string;
  quantity: number;
  material: string | null;
  surface: string;
  catalogServiceId?: string | null;
  unit?: string | null;
  unitPriceCents?: number | null;
  vatRateBasisPoints?: 0 | 700 | 1900 | null;
  finished?: boolean;
  extraWork: OrderCardExtraWork[];
};
export type OrderCardEvidence = {
  key: string;
  source: "ORDER_STATION_ATTACHMENT" | "ORDER_INTAKE_ATTACHMENT" | "LEGACY_SCAN_UPLOAD";
  state: "VERIFIED" | "LEGACY_RECORDED" | "LEGACY_PARTIAL" | "NOT_RECORDED";
  recordedAt: string;
  itemIds: string[];
};
export type OrderCardPayment = {
  mode: "vorkasse" | "abholung" | "rechnung" | "keiner";
  invoiceState: "not_issued" | "issued";
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  status: "offen" | "teilbezahlt" | "bezahlt" | null;
  openAmountCents: number | null;
  goodsOutAllowed: boolean;
  paymentEvent: null | {
    eventId: string;
    actorId: string;
    occurredAt: string;
    method: "bar" | "ueberweisung" | "karte";
  };
  goodsOut: null | {
    eventId: string;
    actorId: string;
    occurredAt: string;
    mode: "versand" | "abholung";
  };
};
export type OrderCardPaymentContext =
  | { kind: "available"; value: OrderCardPayment }
  | { kind: "restricted" | "unavailable"; message: string };
export type OrderCardActionReceipt = {
  kind: "handoff" | "evidence" | "freeze" | "invoice" | "payment" | "goods-out" | "due-date" | "content" | "item-finished" | "duplicate" | "label";
  actorId: string;
  occurredAt: string;
  eventId: string;
  receiptId: string;
};
export type OrderCardActionFeedback =
  | { kind: "idle" | "submitting"; message: string }
  | { kind: "success"; message: string; receipt: OrderCardActionReceipt }
  | { kind: "conflict" | "error"; message: string };
export type OrderCardActionAvailability = {
  visible: boolean;
  enabled: boolean;
  reason: string | null;
};
export type OrderCardAgreementPorts = OrderCardActionAvailability & {
  onCreate: () => void;
  onEdit?: () => void;
  onRevoke?: () => void;
};
export type OrderCardActionPorts = {
  dueDate?: OrderCardActionAvailability;
  content?: OrderCardActionAvailability;
  itemStatus?: OrderCardActionAvailability;
  contact?: OrderCardActionAvailability;
  photo?: OrderCardActionAvailability;
  handoff: OrderCardActionAvailability;
  evidence: OrderCardActionAvailability;
  freeze: OrderCardActionAvailability;
  invoice: OrderCardActionAvailability;
  payment: OrderCardActionAvailability;
  goodsOut: OrderCardActionAvailability;
  agreement?: OrderCardAgreementPorts;
  label: OrderCardActionAvailability;
  feedback: OrderCardActionFeedback;
  onSaveContent?: (input: {
    note: string | null;
    items: Array<{
      id: string;
      catalogServiceId: string | null;
      name: string;
      quantity: number;
      material: string | null;
      surface: string;
      unit: string | null;
      unitPriceCents: number | null;
      vatRateBasisPoints: 0 | 700 | 1900 | null;
    }>;
  }) => void | Promise<void>;
  onToggleItemFinished?: (itemId: string, finished: boolean) => void | Promise<void>;
  onOpenStatusMail?: () => void;
  onCallCustomer?: () => void;
  onOpenPhoto?: () => void;
  onOpenDocument?: () => void;
  onOpenQuote?: () => void;
  onRecordComplaint?: () => void;
  onDuplicate?: () => void | Promise<void>;
  onChangeDueDate?: (dueDate: string, reason: string) => void | Promise<void>;
  onHandoff: () => void | Promise<void>;
  onFreeze: () => void | Promise<void>;
  onIssueInvoice: (
    prices?: Array<{ itemId: string; unitPriceCents: number }>,
  ) => void | Promise<void>;
  onConfirmPayment: (
    method: "bar" | "ueberweisung" | "karte",
  ) => Promise<boolean>;
  onRecordGoodsOut: (
    mode: OrderCardGoodsOutMode,
    agreement?: OrderCardGoodsOutAgreement,
  ) => Promise<boolean>;
  onPrintLabel: () => void | Promise<void>;
  onReload: () => void | Promise<void>;
};
export type OrderCardModel = {
  id: string;
  version: number;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  title: string;
  note: string | null;
  station: string;
  status: string;
  cancellation?:{reason:string;at:string;actor:string;quoteId:string|null;quoteNumber:string|null};
  dueAt: string | null;
  intakeAt: string;
  assignedTo: string | null;
  dueDateChanges?: Array<{
    eventId: string;
    changedTo: string;
    reason: string;
    changedAt: string;
    changedBy: string;
    aggregateVersion: number;
  }>;
  labelPrints?: Array<{
    eventId: string;
    occurredAt: string;
  }>;
  items: OrderCardItem[];
  evidence: OrderCardEvidence[];
  frozenAt: string | null;
  totalAmountCents: number | null;
  agreement?: CustomerAgreementRecord | null;
  agreementHint?: {
    label: string;
    type: CustomerAgreementRecord["type"];
    state: "expired" | "revoked";
    date: string;
  } | null;
  handoverMode?: "pickup" | "shipping" | null;
  payment: OrderCardPaymentContext;
  catalog?: Array<{
    id: string;
    name: string;
    surface: string;
    unit: string;
    netPriceCents: number;
    vatRateBasisPoints: 0 | 700 | 1900;
  }>;
};
export type OrderCardState =
  | { kind: "loading" }
  | { kind: "denied" | "not-found" | "error" | "conflict"; message: string }
  | { kind: "data"; card: OrderCardModel };
