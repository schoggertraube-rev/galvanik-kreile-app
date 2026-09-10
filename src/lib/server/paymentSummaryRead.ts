import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import {
  canReadPaymentSummary,
  mapOrderPaymentStateRow,
  mapPaymentSummaryRow,
  type OrderPaymentState,
  type OrderPaymentStateRow,
  type PaymentSummary,
  type PaymentSummaryRow,
} from "@/lib/server/paymentContract";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

export type PaymentSummaryReadResult =
  | { code: "OK"; data: PaymentSummary[] }
  | { code: "FORBIDDEN"; message: string }
  | { code: "UNAVAILABLE"; message: string };

export type ReadOrderPaymentStateInput = { orderId: string };

export type OrderPaymentStateReadResult =
  | { code: "OK"; data: OrderPaymentState }
  | { code: "NOT_FOUND"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

const ORDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function readDiagnostic(error: unknown, key: "message" | "details" | "hint"): string | null {
  if (!error || typeof error !== "object") return null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.slice(0, 500) : null;
}

function logReadFailure(label: string, error: unknown): void {
  console.error(label, {
    message: readDiagnostic(error, "message"),
    details: readDiagnostic(error, "details"),
    hint: readDiagnostic(error, "hint"),
  });
}

export async function readPaymentSummary(
  authorization: AuthorizationSnapshot,
): Promise<PaymentSummaryReadResult> {
  if (!canReadPaymentSummary(authorization)) {
    return { code: "FORBIDDEN", message: "Zahlungsübersicht ist mit dieser Rolle nicht erlaubt." };
  }

  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<PaymentSummaryRow>(sql`
        SELECT *
        FROM private.v_payment_summary_v1
        ORDER BY invoice_number DESC NULLS LAST, invoice_id
        LIMIT 251
      `);
      if (rows.length > 250) throw new Error("PAYMENT_SUMMARY_AMBIGUOUS");
      return rows.map((row) => mapPaymentSummaryRow(row, authorization));
    });
    return { code: "OK", data };
  } catch (error) {
    logReadFailure("readPaymentSummary database error", error);
    return { code: "UNAVAILABLE", message: "Zahlungsübersicht konnte nicht sicher geladen werden." };
  }
}

export async function readOrderPaymentState(
  authorization: AuthorizationSnapshot,
  input: unknown,
): Promise<OrderPaymentStateReadResult> {
  if (
    !input
    || typeof input !== "object"
    || Array.isArray(input)
    || Object.keys(input).length !== 1
    || typeof (input as { orderId?: unknown }).orderId !== "string"
    || !ORDER_ID_PATTERN.test((input as { orderId: string }).orderId)
  ) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Zahlungsabfrage." };
  }
  if (!canReadPaymentSummary(authorization)) {
    return { code: "FORBIDDEN", message: "Zahlungs- und Warenausgangsdaten sind mit dieser Rolle nicht erlaubt." };
  }

  const orderId = (input as ReadOrderPaymentStateInput).orderId;
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<OrderPaymentStateRow>(sql`
        SELECT *
        FROM private.v_goods_out_ui_state_v1
        WHERE order_id = ${orderId}
        LIMIT 2
      `);
      if (rows.length === 0) return null;
      if (rows.length !== 1 || !rows[0]) throw new Error("ORDER_PAYMENT_STATE_AMBIGUOUS");
      return mapOrderPaymentStateRow(rows[0], authorization);
    });
    return data
      ? { code: "OK", data }
      : { code: "NOT_FOUND", message: "Zahlungs- und Warenausgangsdaten sind nicht verfügbar." };
  } catch (error) {
    logReadFailure("readOrderPaymentState database error", error);
    return { code: "UNAVAILABLE", message: "Zahlungs- und Warenausgangsdaten konnten nicht sicher geladen werden." };
  }
}
