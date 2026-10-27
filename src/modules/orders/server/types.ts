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
  amountCents: number;
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
  source: string;
  state: string;
  recordedAt: string;
  itemIds: string[];
};
export type OrderCardPayment = {
  mode: "vorkasse" | "abholung" | "rechnung";
  invoiceState: "not_issued" | "issued";
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  status: "offen" | "teilbezahlt" | "bezahlt" | null;
  openAmountCents: number | null;
  goodsOutAllowed: boolean;
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
  kind: "handoff" | "evidence" | "freeze" | "invoice" | "payment" | "goods-out" | "due-date" | "content" | "item-finished" | "duplicate";
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
  onDuplicate?: () => void | Promise<void>;
  onChangeDueDate?: (dueDate: string, reason: string) => void | Promise<void>;
  onHandoff: () => void | Promise<void>;
  onFreeze: () => void | Promise<void>;
  onIssueInvoice: (
    prices?: Array<{ itemId: string; unitPriceCents: number }>,
  ) => void | Promise<void>;
  onConfirmPayment: (
    method: "bar" | "ueberweisung" | "karte",
  ) => void | Promise<void>;
  onRecordGoodsOut: (mode: "versand" | "abholung") => void | Promise<void>;
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
  items: OrderCardItem[];
  evidence: OrderCardEvidence[];
  frozenAt: string | null;
  totalAmountCents: number | null;
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
