"use server";

import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq, and, sql, notInArray, notIlike } from "drizzle-orm";
import { checkAppAuth, ActionResult } from "@/lib/server/authHelper";
import { unstable_noStore as noStore } from "next/cache";
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

export async function getOrdersDb(): Promise<ActionResult<OrderResponse[]>> {
  noStore();
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  try {
    const { getOperationalOrders } = await import("@/lib/server/operationalOrders");
    const data = await getOperationalOrders();
    return { ok: true, data };
  } catch (error: unknown) {
    console.error("[DB_ERROR_DETAIL]", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Aufträge", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

/** Leichtgewichtige Variante nur für Header-Badge — führt nur COUNT(*) aus. */
export async function getOrderCountDb(): Promise<ActionResult<{ count: number }>> {
  noStore();
  const auth = await checkAppAuth();
  if (!auth.ok) return auth;

  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, "galvanik-kreile"),
          notInArray(
            sql`coalesce(${orders.source}, 'manual')`,
            ["seed", "test", "demo", "integration-test"]
          ),
          notIlike(sql`coalesce(${orders.orderNumber}, '')`, "A-SEED-%"),
          notIlike(sql`coalesce(${orders.orderNumber}, '')`, "%TEST%")
        )
      );
    return { ok: true, data: { count: result[0]?.count ?? 0 } };
  } catch (error: unknown) {
    console.error("[ORDER_COUNT_ERROR]", error instanceof Error ? error.message : String(error));
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Zählen der Aufträge", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
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
