import "server-only";

import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type { CustomerCommandContext, EnableCustomerInvoiceTermsInput } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function normalize(input: unknown): EnableCustomerInvoiceTermsInput | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (Object.keys(value).sort().join(",") !== "cashDiscountDays,cashDiscountPercent,clientEventId,customerId,targetDays") return null;
  if (typeof value.clientEventId !== "string" || !UUID.test(value.clientEventId)
    || typeof value.customerId !== "string" || value.customerId.length < 1 || value.customerId.length > 128
    || !Number.isInteger(value.targetDays) || (value.targetDays as number) < 1 || (value.targetDays as number) > 90
    || typeof value.cashDiscountPercent !== "number" || !Number.isFinite(value.cashDiscountPercent)
    || value.cashDiscountPercent < 0 || value.cashDiscountPercent > 100
    || Math.round(value.cashDiscountPercent * 100) !== value.cashDiscountPercent * 100
    || !Number.isInteger(value.cashDiscountDays) || (value.cashDiscountDays as number) < 0
    || (value.cashDiscountDays as number) > (value.targetDays as number)) return null;
  return value as unknown as EnableCustomerInvoiceTermsInput;
}

export async function enableCustomerInvoiceTermsCommand(context: CustomerCommandContext, input: unknown) {
  const value = normalize(input);
  if (!value) return { code: "VALIDATION_ERROR" as const, message: "Zahlungsziel oder Skonto ist ungÃ¼ltig." };
  if (!context.capabilities.canCreateCustomer || !context.capabilities.canManageMoney) {
    return { code: "FORBIDDEN" as const, message: "Rechnung auf Ziel darf nur mit dem Bereich Geld freigeschaltet werden." };
  }
  try {
    return await withPrivilegedTenantTransaction(context, async (tx) => {
      const rows = await tx.execute<{ result_code: string; replayed: boolean }>(sql`
        SELECT * FROM private.enable_customer_invoice_terms_v1(
          ${context.tenantId}, ${context.userId}::uuid, ${value.clientEventId}::uuid,
          ${value.customerId}, ${value.targetDays}, ${value.cashDiscountPercent}, ${value.cashDiscountDays}
        )
      `);
      const row = rows.length === 1 ? rows[0] : null;
      if (!row || !["OK", "NOT_FOUND", "CONFLICT", "VALIDATION_ERROR", "INCOMPLETE"].includes(row.result_code)) {
        throw new Error("CUSTOMER_INVOICE_TERMS_RESULT_INVALID");
      }
      if (row.result_code === "OK") return { code: "OK" as const, replayed: row.replayed };
      const messages = {
        NOT_FOUND: "Kunde ist nicht verfÃ¼gbar.",
        CONFLICT: "Anfragekennung wurde bereits anders verwendet.",
        VALIDATION_ERROR: "Zahlungsziel oder Skonto ist ungÃ¼ltig.",
        INCOMPLETE: "Rechnung auf Ziel braucht vollstÃ¤ndige Kundendaten.",
      } as const;
      return { code: row.result_code as keyof typeof messages, message: messages[row.result_code as keyof typeof messages] };
    });
  } catch (error) {
    console.error("customer_invoice_terms_command_failed", error);
    return { code: "UNAVAILABLE" as const, message: "Rechnung auf Ziel konnte nicht sicher freigeschaltet werden." };
  }
}
