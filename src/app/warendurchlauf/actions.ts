"use server";

import {
  getOperationalOrders,
  getOperationalOrdersByStation,
  getOperationalOrdersReadyForStation,
  type OperationalOrder,
} from "@/lib/server/operationalOrders";
import { transitionOrderProcess } from "@/app/actions/orders.actions";
import { resolveAuthorization } from "@/lib/server/authorization";
import { parseOrderStation } from "@/lib/orders/orderMutationContract";
import {
  calculateWarendurchlaufMetrics,
  type WarendurchlaufMetrics,
} from "@/lib/warendurchlauf/kpis";
import type { PermissionKey } from "@/lib/auth/authorizationContract";

type WarendurchlaufAccess =
  | { ok: true; data: { tenantId: string; userId: string } }
  | { ok: false; error: "AUTH_ERROR" | "FORBIDDEN"; message: string };

export type WarendurchlaufKpiData = WarendurchlaufMetrics & {
  orders: OperationalOrder[];
};

async function requireWarendurchlaufAccess(permission: PermissionKey): Promise<WarendurchlaufAccess> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) {
    return {
      ok: false,
      error: authorization.reason === "TENANT_SUSPENDED" || authorization.reason === "TENANT_MAINTENANCE"
        ? "FORBIDDEN"
        : "AUTH_ERROR",
      message: authorization.message,
    };
  }
  if (!authorization.data.permissions.includes(permission)) {
    return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung für diese Warendurchlauf-Aktion." };
  }
  return {
    ok: true,
    data: { tenantId: authorization.data.tenantId, userId: authorization.data.userId },
  };
}

export async function getStationOrders(stationId: string) {
  const auth = await requireWarendurchlaufAccess("perm_view_leitstand");
  if (!auth.ok) return auth;
  try {
    const station = parseOrderStation(stationId);
    const orders = await getOperationalOrdersByStation(station, auth.data.tenantId);
    return { ok: true, data: orders };
  } catch (error) {
    console.error("Failed to load station orders", error);
    return { ok: false, error: "QUERY_ERROR", message: "Stationsaufträge konnten nicht geladen werden." };
  }
}

export async function getStationReadyOrders(stationId: string) {
  const auth = await requireWarendurchlaufAccess("perm_view_leitstand");
  if (!auth.ok) return auth;
  try {
    const station = parseOrderStation(stationId);
    const orders = await getOperationalOrdersReadyForStation(station, auth.data.tenantId);
    return { ok: true, data: orders };
  } catch (error) {
    console.error("Failed to load ready station orders", error);
    return { ok: false, error: "QUERY_ERROR", message: "Bereitstehende Aufträge konnten nicht geladen werden." };
  }
}

export async function startProcessingStation(
  orderId: string,
  expectedStation: string,
  clientRequestId: string,
) {
  const auth = await requireWarendurchlaufAccess("perm_op_status");
  if (!auth.ok) return auth;
  return transitionOrderProcess({
    orderId,
    action: "start",
    expectedStation,
    clientRequestId,
  });
}

export async function getWarendurchlaufKPIs() {
  const auth = await requireWarendurchlaufAccess("perm_view_leitstand");
  if (!auth.ok) return auth;

  try {
    const allOrdersQuery = await getOperationalOrders(auth.data.tenantId);
    const metrics = calculateWarendurchlaufMetrics(allOrdersQuery);

    return {
      ok: true,
      data: {
        ...metrics,
        orders: allOrdersQuery,
      } satisfies WarendurchlaufKpiData,
    };
  } catch (error) {
    console.error("Error in getWarendurchlaufKPIs:", error);
    return { ok: false, error: "QUERY_ERROR", message: "Warendurchlauf-Kennzahlen konnten nicht geladen werden." };
  }
}
