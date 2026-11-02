"use server";

import {
  erfasseAuftragAusEingangCommand,
  type ErfasseAuftragResult,
} from "@/modules/eingang/server-public";
import { hasAuthorizationArea, resolveAuthorization } from "@/lib/server/authorization";
import { readCustomerOrderReadinessCommand } from "@/modules/customers/server-public";

function existingCustomerId(input: unknown): string | null {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return null;
  const customer = (input as Record<string, unknown>).customer;
  if (customer === null || typeof customer !== "object" || Array.isArray(customer)) return null;
  const value = customer as Record<string, unknown>;
  return value.mode === "EXISTING" && typeof value.customerId === "string" && value.customerId.trim().length > 0
    ? value.customerId.trim()
    : null;
}

export async function erfasseAuftragAusEingangAction(input: unknown): Promise<ErfasseAuftragResult> {
  const customerId = existingCustomerId(input);
  const authorization = await resolveAuthorization();
  if (!customerId || !authorization.ok || !hasAuthorizationArea(authorization.data, "eingang")) {
    return erfasseAuftragAusEingangCommand(input);
  }
  const customer = await readCustomerOrderReadinessCommand(authorization.data, {
    customerId,
    requirePaymentPreference: hasAuthorizationArea(authorization.data, "geld"),
  });
  if (customer.code !== "OK") {
    return customer.code === "NOT_FOUND"
      ? { code: "VALIDATION_ERROR", message: customer.message }
      : { code: "CONFLICT", message: customer.message };
  }
  const readiness = customer.readiness;
  if (!readiness.ready) {
    return {
      code: "CUSTOMER_INCOMPLETE",
      message: `Kunde ist für den Auftrag unvollständig: ${readiness.issues.map((issue) => issue.message).join(", ")}. Bitte in der Kundenkarte ergänzen.`,
      missing: readiness.issues.map((issue) => issue.field),
    };
  }
  return erfasseAuftragAusEingangCommand(input, { customerId, readiness });
}
