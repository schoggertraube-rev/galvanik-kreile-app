"use server";

import { unstable_noStore as noStore } from "next/cache";
import type { ActionResult } from "@/lib/server/authHelper";
import {
  resolveAuthorization,
  type AuthorizationSnapshot,
} from "@/lib/server/authorization";
import type { OperationalOrder } from "@/lib/types/operationalOrder";
import {
  transitionWareneingangToGalvanik,
  type OrderStationCommandInput,
  type OrderStationCommandResult,
} from "@/lib/server/commands/orderStationCommand";

// DTO Typen (zur Vereinfachung)
export type OrderResponse = OperationalOrder;

export async function transitionWareneingangToGalvanikAction(
  input: OrderStationCommandInput,
): Promise<OrderStationCommandResult> {
  return transitionWareneingangToGalvanik(input);
}

async function resolveOperationalReadAuthorization(): Promise<ActionResult<AuthorizationSnapshot>> {
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return {
      ok: false,
      error: "DB_ERROR",
      message: "Auftragsdaten sind derzeit nicht verfügbar.",
    };
  }

  if (!authorization.ok) {
    if (authorization.reason === "AUTHORIZATION_UNAVAILABLE") {
      return {
        ok: false,
        error: "DB_ERROR",
        message: "Auftragsdaten sind derzeit nicht verfügbar.",
      };
    }
    return {
      ok: false,
      error: "UNAUTHORIZED",
      message: "Sitzung oder Berechtigung ist nicht verfügbar.",
    };
  }

  if (!authorization.data.permissions.includes("perm_view_leitstand")) {
    return {
      ok: false,
      error: "FORBIDDEN",
      message: "Auftragsansicht ist nicht erlaubt.",
    };
  }

  return { ok: true, data: authorization.data };
}

export async function getOrdersDb(): Promise<ActionResult<OrderResponse[]>> {
  noStore();
  const authorization = await resolveOperationalReadAuthorization();
  if (!authorization.ok) return authorization;

  try {
    const { getOperationalOrders } = await import("@/lib/server/operationalOrders");
    const data = await getOperationalOrders(authorization.data);
    return { ok: true, data };
  } catch (error: unknown) {
    console.error("[ORDER_READ_ERROR]", error);
    return {
      ok: false,
      error: "DB_ERROR",
      message: "Auftragsdaten konnten nicht sicher geladen werden.",
    };
  }
}

/** Tenant-bound count from the same versioned operational read port. */
export async function getOrderCountDb(): Promise<ActionResult<{ count: number }>> {
  noStore();
  const authorization = await resolveOperationalReadAuthorization();
  if (!authorization.ok) return authorization;

  try {
    const { getOperationalOrderCount } = await import("@/lib/server/operationalOrders");
    const count = await getOperationalOrderCount(authorization.data);
    return { ok: true, data: { count } };
  } catch (error: unknown) {
    console.error("[ORDER_COUNT_ERROR]", error);
    return {
      ok: false,
      error: "DB_ERROR",
      message: "Auftragsanzahl konnte nicht sicher geladen werden.",
    };
  }
}

export async function createOrderDb(data: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {
  void data;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Auftragserstellung benötigt den W3-Command-Vertrag." };
}

export async function updateOrderDb(id: string, changes: {
  status?: string;
  currentStationId?: string;
  priorityComputed?: string;
  title?: string;
}): Promise<ActionResult<Record<string, unknown>>> {
  void id;
  void changes;
  // F0-W2C-B1: This legacy ID-only writer has no actor, tenant, ownership, or
  // version contract. It must not start a partial order/item/feedback workflow.
  // W3 will replace it with a command contract; retain this ActionResult shape
  // so existing clients receive an explicit denial instead of a false success.
  return {
    ok: false,
    error: "CONFLICT",
    message: "NOT_AVAILABLE: Auftragsänderungen sind bis zum serverseitigen Command-Vertrag nicht verfügbar.",
  };
}

export async function getRiskOrders(_limit = 3): Promise<{ ok: false; error: "NOT_AVAILABLE"; message: string }> {
  void _limit;
  return { ok: false, error: "NOT_AVAILABLE", message: "NOT_AVAILABLE: Terminrisiken benötigen eine kanonische, quellgestützte Berechnung." };
}

// F0-W2C quarantine: transitionOrderProcess is an unsafe transition port without
// the W3 command contract. It denies every station transition until W3 replaces it.

export async function transitionOrderProcess(params: {
  orderId: string;
  targetStep?: string;
  action?: string;
}): Promise<ActionResult<never>> {
  void params;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Stationswechsel benötigen den W3-Command-Vertrag." };
}

export async function createOrderFromScan(params: {
  customerId?: string;
  customerName?: string;
  title?: string;
  parts: { name: string; quantity: number; surfaceRequested?: string; material?: string }[];
  forceCreateCustomer?: boolean;
}): Promise<
  | { ok: true; data: { orderId: string; newCustomerId?: string; status: string; customerChoices?: Record<string, unknown>[] } }
  | { ok: false; error: string; message: string; details?: unknown }
> {
  void params;
  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Auftragserstellung benötigt den W3-Command-Vertrag." };
}
