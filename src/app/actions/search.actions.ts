"use server";

import { resolveAuthorization } from "@/lib/server/authorization";
import { searchOrderIntakeCustomers } from "@/lib/server/orderIntakeRead";
import { readTenantOperationalOrders } from "@/lib/server/orderStationRead";
import {
  normalizeSearchQuery,
  searchTenant,
  type SearchTenantResult,
} from "@/modules/suche/public";

const UNAVAILABLE_MESSAGE = "Suche ist derzeit nicht verfügbar.";
const DENIAL_MESSAGE = "Sitzung oder Berechtigung ist nicht verfügbar.";

/**
 * Closed-world read-port binding:
 * - readTenantOperationalOrders -> private.v_operational_station_queue_v1
 * - searchOrderIntakeCustomers -> private.v_order_intake_customers_v1
 */

function diagnosticFields(error: unknown): { message?: string; details?: string; hint?: string } {
  if (!error || typeof error !== "object") return {};
  const candidate = error as Record<string, unknown>;
  const result: { message?: string; details?: string; hint?: string } = {};
  if (typeof candidate.message === "string") result.message = candidate.message;
  if (typeof candidate.details === "string") result.details = candidate.details;
  if (typeof candidate.hint === "string") result.hint = candidate.hint;
  return result;
}

function logPortFailure(port: "orders" | "customers", error: unknown): void {
  console.error("searchTenantAction read-port failure", {
    port,
    ...diagnosticFields(error),
  });
}

export async function searchTenantAction(query: string): Promise<SearchTenantResult> {
  const normalized = normalizeSearchQuery(query);
  if (normalized.code === "INVALID") {
    return { code: "VALIDATION_ERROR", message: "Suchbegriff ist ungültig oder zu lang." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: UNAVAILABLE_MESSAGE };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: UNAVAILABLE_MESSAGE }
      : { code: "UNAUTHENTICATED", message: DENIAL_MESSAGE };
  }

  return searchTenant(query, {
    readOrders: async () => {
      try {
        return await readTenantOperationalOrders(authorization.data);
      } catch (error) {
        logPortFailure("orders", error);
        throw error;
      }
    },
    searchCustomers: async (customerQuery) => {
      try {
        return await searchOrderIntakeCustomers(authorization.data, { query: customerQuery });
      } catch (error) {
        logPortFailure("customers", error);
        throw error;
      }
    },
  });
}
