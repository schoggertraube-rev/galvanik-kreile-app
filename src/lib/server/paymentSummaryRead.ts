import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import {
  canReadPaymentSummary,
  mapPaymentSummaryRow,
  type PaymentSummary,
  type PaymentSummaryRow,
} from "@/lib/server/paymentContract";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

export type PaymentSummaryReadResult =
  | { code: "OK"; data: PaymentSummary[] }
  | { code: "FORBIDDEN"; message: string }
  | { code: "UNAVAILABLE"; message: string };

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
  } catch {
    return { code: "UNAVAILABLE", message: "Zahlungsübersicht konnte nicht sicher geladen werden." };
  }
}
