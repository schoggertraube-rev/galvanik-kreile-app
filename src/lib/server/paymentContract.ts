import type { AuthorizationSnapshot } from "@/lib/server/authorization";

export const PAYMENT_CONTRACT_VERSION = 1 as const;
export const PAYMENT_MODES = ["vorkasse", "abholung", "rechnung"] as const;

export type PaymentMode = (typeof PAYMENT_MODES)[number];
export type PaymentStatus = "offen" | "teilbezahlt" | "bezahlt";
export type PaymentMethod = "bar" | "ueberweisung" | "karte";
export type PaymentCurrency = "EUR";

export type PaymentSummary = {
  invoiceId: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  totalAmountCents: number;
  paidAmountCents: number;
  openAmountCents: number;
  mode: PaymentMode;
  status: PaymentStatus;
  currency: PaymentCurrency;
  method: PaymentMethod | null;
  paidAt: string | null;
  receiptId: string | null;
  eventId: string | null;
  correlationId: string | null;
  paymentModeVersion: number;
  paymentVersion: number;
  goodsOutAllowed: boolean;
};

export type PaymentSummaryRow = {
  invoice_id: string;
  tenant_id: string;
  order_id: string;
  order_number: string;
  invoice_number: string;
  total_amount_cents: number | string;
  payment_contract_version: number | string | null;
  payment_mode: string | null;
  payment_status: string | null;
  payment_open_amount_cents: number | string | null;
  payment_paid_amount_cents: number | string | null;
  payment_currency: string | null;
  payment_method: string | null;
  payment_paid_at: Date | string | null;
  payment_receipt_id: string | null;
  payment_event_id: string | null;
  payment_correlation_id: string | null;
  payment_mode_version: number | string;
  payment_version: number | string | null;
  goods_out_allowed: boolean;
  integrity_ok: boolean;
};

export const PAYMENT_SUMMARY_READ_ROLES = ["buero", "werkstatt", "meister", "admin"] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const INVOICE_NUMBER_PATTERN = /^R-[0-9]{4}-[0-9]{4,}$/;

function isPaymentReadRole(value: AuthorizationSnapshot["role"]): boolean {
  return PAYMENT_SUMMARY_READ_ROLES.includes(value as (typeof PAYMENT_SUMMARY_READ_ROLES)[number]);
}

export function canReadPaymentSummary(authorization: AuthorizationSnapshot): boolean {
  return authorization.active === true
    && authorization.tenantId === "galvanik-kreile"
    && isPaymentReadRole(authorization.role)
    && authorization.permissions.includes("perm_view_leitstand");
}

function isCanonicalTextId(value: unknown): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length >= 1
    && value.length <= 128;
}

function toSafeInteger(value: unknown, label: string): number {
  if (value === null || value === undefined) throw new Error(label);
  if (typeof value === "string" && (value.trim() !== value || value.length === 0)) {
    throw new Error(label);
  }
  if (typeof value !== "number" && typeof value !== "string") throw new Error(label);
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(label);
  return parsed;
}

function toIsoTimestamp(value: unknown): string {
  const parsed = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(parsed.getTime())) throw new Error("PAYMENT_SUMMARY_TIME_INVALID");
  return parsed.toISOString();
}

export function isPaymentMode(value: unknown): value is PaymentMode {
  return PAYMENT_MODES.includes(value as PaymentMode);
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return value === "offen" || value === "teilbezahlt" || value === "bezahlt";
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "bar" || value === "ueberweisung" || value === "karte";
}

export function mapPaymentSummaryRow(
  row: PaymentSummaryRow,
  authorization: AuthorizationSnapshot,
): PaymentSummary {
  const contractVersion = toSafeInteger(row.payment_contract_version, "PAYMENT_SUMMARY_CONTRACT_INVALID");
  const totalAmountCents = toSafeInteger(row.total_amount_cents, "PAYMENT_SUMMARY_TOTAL_INVALID");
  const paidAmountCents = toSafeInteger(row.payment_paid_amount_cents, "PAYMENT_SUMMARY_PAID_INVALID");
  const openAmountCents = toSafeInteger(row.payment_open_amount_cents, "PAYMENT_SUMMARY_OPEN_INVALID");
  const paymentModeVersion = toSafeInteger(row.payment_mode_version, "PAYMENT_SUMMARY_MODE_VERSION_INVALID");
  const paymentVersion = toSafeInteger(row.payment_version, "PAYMENT_SUMMARY_VERSION_INVALID");
  const mode = row.payment_mode;
  const status = row.payment_status;
  const currency = row.payment_currency;
  const method = row.payment_method;

  if (
    !canReadPaymentSummary(authorization)
    || row.integrity_ok !== true
    || row.tenant_id !== authorization.tenantId
    || !UUID_PATTERN.test(row.invoice_id)
    || !isCanonicalTextId(row.order_id)
    || !isCanonicalTextId(row.order_number)
    || !INVOICE_NUMBER_PATTERN.test(row.invoice_number)
    || contractVersion !== PAYMENT_CONTRACT_VERSION
    || !isPaymentMode(mode)
    || !isPaymentStatus(status)
    || currency !== "EUR"
    || totalAmountCents < 0
    || paidAmountCents < 0
    || openAmountCents < 0
    || paidAmountCents + openAmountCents !== totalAmountCents
    || paymentModeVersion < 0
    || paymentVersion < 0
    || typeof row.goods_out_allowed !== "boolean"
  ) {
    throw new Error("PAYMENT_SUMMARY_INTEGRITY_INVALID");
  }

  const openStateValid = status === "offen"
    && paidAmountCents === 0
    && openAmountCents === totalAmountCents
    && paymentVersion === 0
    && method === null
    && row.payment_paid_at === null
    && row.payment_receipt_id === null
    && row.payment_event_id === null
    && row.payment_correlation_id === null;
  const settledStateValid = (status === "teilbezahlt" || status === "bezahlt")
    && paymentVersion > 0
    && isPaymentMethod(method)
    && row.payment_paid_at !== null
    && isCanonicalTextId(row.payment_receipt_id)
    && isCanonicalTextId(row.payment_event_id)
    && typeof row.payment_correlation_id === "string"
    && UUID_PATTERN.test(row.payment_correlation_id);
  const paidStateValid = status === "bezahlt"
    && paidAmountCents === totalAmountCents
    && openAmountCents === 0;
  const partialStateValid = status === "teilbezahlt"
    && paidAmountCents > 0
    && openAmountCents > 0;

  if (
    !(openStateValid || (settledStateValid && (paidStateValid || partialStateValid)))
    || row.goods_out_allowed !== (mode === "rechnung" || status === "bezahlt")
  ) {
    throw new Error("PAYMENT_SUMMARY_STATE_INVALID");
  }

  return {
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    orderId: row.order_id,
    orderNumber: row.order_number,
    totalAmountCents,
    paidAmountCents,
    openAmountCents,
    mode,
    status,
    currency: "EUR",
    method: method === null ? null : method,
    paidAt: row.payment_paid_at === null ? null : toIsoTimestamp(row.payment_paid_at),
    receiptId: row.payment_receipt_id,
    eventId: row.payment_event_id,
    correlationId: row.payment_correlation_id,
    paymentModeVersion,
    paymentVersion,
    goodsOutAllowed: row.goods_out_allowed,
  };
}
