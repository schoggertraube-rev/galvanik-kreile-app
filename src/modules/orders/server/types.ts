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
};

export type OrdersViewState =
  | { kind: "loading" }
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "data"; orders: OrdersListItem[] };

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
  | { kind: "restricted"; message: string }
  | { kind: "unavailable"; message: string };

export type OrderCardActionReceipt = {
  kind: "handoff" | "evidence" | "freeze" | "invoice" | "payment" | "goods-out";
  actorId: string;
  occurredAt: string;
  eventId: string;
  receiptId: string;
};

export type OrderCardActionFeedback =
  | { kind: "idle"; message: string }
  | { kind: "submitting"; message: string }
  | { kind: "success"; message: string; receipt: OrderCardActionReceipt }
  | { kind: "conflict" | "error"; message: string };

export type OrderCardActionAvailability = {
  visible: boolean;
  enabled: boolean;
  reason: string | null;
};

export type OrderCardActionPorts = {
  handoff: OrderCardActionAvailability;
  evidence: OrderCardActionAvailability;
  freeze: OrderCardActionAvailability;
  invoice: OrderCardActionAvailability;
  payment: OrderCardActionAvailability;
  goodsOut: OrderCardActionAvailability;
  feedback: OrderCardActionFeedback;
  onHandoff: () => void | Promise<void>;
  onUploadEvidence: (itemId: string, file: File) => void | Promise<void>;
  onFreeze: () => void | Promise<void>;
  onIssueInvoice: () => void | Promise<void>;
  onConfirmPayment: (method: "bar" | "ueberweisung" | "karte") => void | Promise<void>;
  onRecordGoodsOut: (mode: "versand" | "abholung") => void | Promise<void>;
  onReload: () => void | Promise<void>;
};

export type OrderCardModel = {
  id: string;
  version: number;
  orderNumber: string;
  customerId: string;
  customerName: string;
  title: string;
  note: string | null;
  station: string;
  status: string;
  dueAt: string | null;
  intakeAt: string;
  assignedTo: string | null;
  items: OrderCardItem[];
  evidence: OrderCardEvidence[];
  frozenAt: string | null;
  totalAmountCents: number | null;
  payment: OrderCardPaymentContext;
};

export type OrderCardState =
  | { kind: "loading" }
  | { kind: "denied"; message: string }
  | { kind: "not-found"; message: string }
  | { kind: "error"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "data"; card: OrderCardModel };
