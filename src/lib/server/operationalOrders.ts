import "server-only";

import type { OperationalOrder } from "@/lib/types/operationalOrder";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import {
  readTenantOperationalOrderCount,
  readTenantOperationalOrders,
} from "@/lib/server/orderStationRead";

export type { OperationalOrder, OperationalOrderItem } from "@/lib/types/operationalOrder";

export async function getOperationalOrders(
  authorization: Pick<AuthorizationSnapshot,'tenantId'>,
  projection?:{purpose:'today'},
): Promise<OperationalOrder[]> {
  return readTenantOperationalOrders(authorization,projection);
}

export async function getOperationalOrderCount(
  authorization: Pick<AuthorizationSnapshot,'tenantId'>,
): Promise<number> {
  return readTenantOperationalOrderCount(authorization);
}

export async function moveOperationalOrderToStationService(
  orderId: string,
  stationId: string,
  actorId?: string,
) {
  void orderId;
  void stationId;
  void actorId;
  throw new Error("NOT_AVAILABLE: Stationswechsel benötigt den W3-Command-Vertrag.");
}

export async function startProcessingStationService(orderId: string, stationId: string, actorId?: string) {
  void orderId;
  void stationId;
  void actorId;
  throw new Error("NOT_AVAILABLE: Stationsstart benötigt den W3-Command-Vertrag.");
}
