import "server-only";

import { sql } from "drizzle-orm";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { getOrderReadiness } from "../orderReadiness";
import type {
  CustomerCommandContext,
  ReadCustomerOrderReadinessInput,
  ReadCustomerOrderReadinessResult,
} from "./types";

type CustomerOrderReadinessRow = {
  name: string | null;
  phone: string | null;
  contact_person: string | null;
  email: string | null;
  street: string | null;
  zip_code: string | null;
  city: string | null;
  country: string | null;
  payment_preference: string | null;
};

export async function readCustomerOrderReadinessCommand(
  context: Pick<CustomerCommandContext, "tenantId">,
  input: ReadCustomerOrderReadinessInput,
): Promise<ReadCustomerOrderReadinessResult> {
  try {
    const rows = await withPrivilegedTenantTransaction(context, async (tx) => tx.execute<CustomerOrderReadinessRow>(sql`
      SELECT
        customer.name,
        customer.phone,
        customer.contact_person,
        customer.email,
        customer.street,
        customer.zip_code,
        customer.city,
        customer.country,
        customer.payment_preference
      FROM public.customers customer
      WHERE customer.tenant_id = ${context.tenantId}
        AND customer.id = ${input.customerId}
      LIMIT 2
      FOR SHARE
    `));
    const customer = rows.length === 1 ? rows[0] : null;
    if (!customer) return { code: "NOT_FOUND", message: "Der ausgewählte Kunde ist nicht verfügbar." };
    return {
      code: "OK",
      readiness: getOrderReadiness({
        name: customer.name,
        phone: customer.phone,
        contactPerson: customer.contact_person,
        email: customer.email,
        street: customer.street,
        zipCode: customer.zip_code,
        city: customer.city,
        country: customer.country,
        paymentPreference: customer.payment_preference,
      }, { requirePaymentPreference: input.requirePaymentPreference }),
    };
  } catch (error) {
    console.error("[CUSTOMER_ORDER_READINESS_READ_FAILED]", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unbekannter Serverfehler",
    });
    return {
      code: "UNAVAILABLE",
      message: "Kundenstand konnte nicht sicher gelesen werden. Fehlercode: CUSTOMER_ORDER_READINESS_READ_FAILED.",
    };
  }
}
