import { KREILE_TENANT_SLUG } from "@/lib/tenant";
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

export type GoodsOutReadback = {
  eventId: string;
  clientEventId: string;
  correlationId: string;
  eventSchemaVersion: 1 | 2;
  orderVersion: number;
  actorId: string;
  occurredAt: string;
  mode: "versand" | "abholung";
};

export type OrderPaymentState = {
  orderId: string;
  orderNumber: string;
  orderVersion: number;
  physicalStatus: string;
  mode: PaymentMode;
  paymentModeVersion: number;
  invoiceState: "not_issued" | "issued";
  payment: PaymentSummary | null;
  paymentActorId: string | null;
  goodsOut: GoodsOutReadback | null;
  goodsOutAllowed: boolean;
};

export type OrderPaymentStateRow = {
  order_id: string;
  tenant_id: string;
  order_number: string;
  order_version: number | string;
  station: string;
  current_station: string;
  current_station_id: string;
  order_status: string;
  payment_mode: string;
  payment_mode_version: number | string;
  invoice_state: string;
  active_invoice_count: number | string;
  invoice_id: string | null;
  invoice_number: string | null;
  total_amount_cents: number | string | null;
  payment_contract_version: number | string | null;
  payment_status: string | null;
  payment_open_amount_cents: number | string | null;
  payment_paid_amount_cents: number | string | null;
  payment_currency: string | null;
  payment_method: string | null;
  payment_paid_at: Date | string | null;
  payment_receipt_id: string | null;
  payment_event_id: string | null;
  payment_correlation_id: string | null;
  payment_version: number | string | null;
  payment_goods_out_allowed: boolean | null;
  payment_integrity_ok: boolean | null;
  payment_actor_id: string | null;
  goods_out_event_count: number | string;
  goods_out_event_id: string | null;
  goods_out_client_event_id: string | null;
  goods_out_correlation_id: string | null;
  goods_out_event_schema_version: number | string | null;
  goods_out_order_version: number | string | null;
  goods_out_actor_id: string | null;
  goods_out_occurred_at: string | null;
  goods_out_mode: string | null;
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
    && authorization.tenantId === KREILE_TENANT_SLUG
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

export function mapOrderPaymentStateRow(
  row: OrderPaymentStateRow,
  authorization: AuthorizationSnapshot,
): OrderPaymentState {
  const orderVersion = toSafeInteger(row.order_version, "ORDER_PAYMENT_STATE_VERSION_INVALID");
  const paymentModeVersion = toSafeInteger(
    row.payment_mode_version,
    "ORDER_PAYMENT_STATE_MODE_VERSION_INVALID",
  );
  const activeInvoiceCount = toSafeInteger(
    row.active_invoice_count,
    "ORDER_PAYMENT_STATE_INVOICE_COUNT_INVALID",
  );
  const goodsOutEventCount = toSafeInteger(
    row.goods_out_event_count,
    "ORDER_PAYMENT_STATE_GOODS_OUT_COUNT_INVALID",
  );
  const mode = row.payment_mode;
  const invoiceState = row.invoice_state;

  if (
    !canReadPaymentSummary(authorization)
    || row.integrity_ok !== true
    || row.tenant_id !== authorization.tenantId
    || !isCanonicalTextId(row.order_id)
    || !isCanonicalTextId(row.order_number)
    || !isCanonicalTextId(row.station)
    || row.station !== row.current_station
    || row.station !== row.current_station_id
    || row.station !== row.order_status
    || !isPaymentMode(mode)
    || paymentModeVersion < 0
    || (invoiceState !== "not_issued" && invoiceState !== "issued")
    || activeInvoiceCount !== (invoiceState === "issued" ? 1 : 0)
    || typeof row.goods_out_allowed !== "boolean"
    || goodsOutEventCount < 0
    || goodsOutEventCount > 1
  ) {
    throw new Error("ORDER_PAYMENT_STATE_INTEGRITY_INVALID");
  }

  let payment: PaymentSummary | null = null;
  if (invoiceState === "issued") {
    if (
      row.invoice_id === null
      || row.invoice_number === null
      || row.payment_goods_out_allowed === null
      || row.payment_integrity_ok !== true
    ) throw new Error("ORDER_PAYMENT_STATE_INVOICE_INVALID");
    payment = mapPaymentSummaryRow({
      invoice_id: row.invoice_id,
      tenant_id: row.tenant_id,
      order_id: row.order_id,
      order_number: row.order_number,
      invoice_number: row.invoice_number,
      total_amount_cents: row.total_amount_cents as number | string,
      payment_contract_version: row.payment_contract_version,
      payment_mode: row.payment_mode,
      payment_status: row.payment_status,
      payment_open_amount_cents: row.payment_open_amount_cents,
      payment_paid_amount_cents: row.payment_paid_amount_cents,
      payment_currency: row.payment_currency,
      payment_method: row.payment_method,
      payment_paid_at: row.payment_paid_at,
      payment_receipt_id: row.payment_receipt_id,
      payment_event_id: row.payment_event_id,
      payment_correlation_id: row.payment_correlation_id,
      payment_mode_version: row.payment_mode_version,
      payment_version: row.payment_version,
      goods_out_allowed: row.payment_goods_out_allowed,
      integrity_ok: row.payment_integrity_ok,
    }, authorization);
  } else {
    const invoiceFields = [
      row.invoice_id,
      row.invoice_number,
      row.total_amount_cents,
      row.payment_contract_version,
      row.payment_status,
      row.payment_open_amount_cents,
      row.payment_paid_amount_cents,
      row.payment_currency,
      row.payment_method,
      row.payment_paid_at,
      row.payment_receipt_id,
      row.payment_event_id,
      row.payment_correlation_id,
      row.payment_version,
      row.payment_actor_id,
    ];
    if (invoiceFields.some((value) => value !== null)) {
      throw new Error("ORDER_PAYMENT_STATE_UNISSUED_VALUES_INVALID");
    }
  }

  let goodsOut: GoodsOutReadback | null = null;
  if (goodsOutEventCount === 1) {
    const eventSchemaVersion = toSafeInteger(
      row.goods_out_event_schema_version,
      "ORDER_PAYMENT_STATE_GOODS_OUT_SCHEMA_INVALID",
    );
    const goodsOutOrderVersion = toSafeInteger(
      row.goods_out_order_version,
      "ORDER_PAYMENT_STATE_GOODS_OUT_VERSION_INVALID",
    );
    if (
      typeof row.goods_out_event_id !== "string"
      || !UUID_PATTERN.test(row.goods_out_event_id)
      || typeof row.goods_out_client_event_id !== "string"
      || !UUID_PATTERN.test(row.goods_out_client_event_id)
      || typeof row.goods_out_correlation_id !== "string"
      || !UUID_PATTERN.test(row.goods_out_correlation_id)
      || (eventSchemaVersion !== 1 && eventSchemaVersion !== 2)
      || goodsOutOrderVersion !== orderVersion
      || typeof row.goods_out_actor_id !== "string"
      || !UUID_PATTERN.test(row.goods_out_actor_id)
      || typeof row.goods_out_occurred_at !== "string"
      || !Number.isFinite(new Date(row.goods_out_occurred_at).getTime())
      || (row.goods_out_mode !== "versand" && row.goods_out_mode !== "abholung")
    ) throw new Error("ORDER_PAYMENT_STATE_GOODS_OUT_INVALID");
    goodsOut = {
      eventId: row.goods_out_event_id,
      clientEventId: row.goods_out_client_event_id,
      correlationId: row.goods_out_correlation_id,
      eventSchemaVersion,
      orderVersion: goodsOutOrderVersion,
      actorId: row.goods_out_actor_id,
      occurredAt: toIsoTimestamp(row.goods_out_occurred_at),
      mode: row.goods_out_mode,
    };
  } else if ([
    row.goods_out_event_id,
    row.goods_out_client_event_id,
    row.goods_out_correlation_id,
    row.goods_out_event_schema_version,
    row.goods_out_order_version,
    row.goods_out_actor_id,
    row.goods_out_occurred_at,
    row.goods_out_mode,
  ].some((value) => value !== null)) {
    throw new Error("ORDER_PAYMENT_STATE_GOODS_OUT_EMPTY_INVALID");
  }

  if (payment && row.payment_actor_id !== null && !UUID_PATTERN.test(row.payment_actor_id)) {
    throw new Error("ORDER_PAYMENT_STATE_PAYMENT_ACTOR_INVALID");
  }
  if (payment?.eventId && row.payment_actor_id === null) {
    throw new Error("ORDER_PAYMENT_STATE_PAYMENT_ACTOR_MISSING");
  }

  return {
    orderId: row.order_id,
    orderNumber: row.order_number,
    orderVersion,
    physicalStatus: row.station,
    mode,
    paymentModeVersion,
    invoiceState,
    payment,
    paymentActorId: row.payment_actor_id,
    goodsOut,
    goodsOutAllowed: row.goods_out_allowed,
  };
}
