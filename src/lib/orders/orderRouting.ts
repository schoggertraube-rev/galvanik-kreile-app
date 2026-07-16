import {
  normalizeStoredOrderStatus,
  parseOrderStation,
  type OrderStation,
} from "@/lib/orders/orderMutationContract";
import { parseRouteSnapshot, type RouteSnapshotV1 } from "@/lib/orders/routeSnapshot";

export type OrderRoutingSnapshot = {
  currentStationId?: string | null;
  status: string;
};

export function isOrderReadyForStation(
  order: OrderRoutingSnapshot,
  targetStation: OrderStation,
): boolean {
  try {
    return parseOrderStation(order.currentStationId) === targetStation
      && normalizeStoredOrderStatus(order.status) === "ready";
  } catch {
    return false;
  }
}

export type BulkRoutableItem = {
  currentStationId: string | null;
  stationSequence: unknown;
  currentStep: number | null;
};

export type BulkRoutingConflict =
  | "ORDER_WITHOUT_ITEMS"
  | "ITEM_STATION_DIVERGENCE"
  | "POSITION_ROUTE_REQUIRES_UNIT_ENGINE";

export type HomogeneousRouteTransition = {
  snapshot: RouteSnapshotV1;
  completedStep: number;
  nextStep: number;
  nextStation: OrderStation;
};

export type HomogeneousRouteResult =
  | { ok: true; data: HomogeneousRouteTransition }
  | { ok: false; conflict: BulkRoutingConflict };

export type HomogeneousTerminalRoute = {
  snapshot: RouteSnapshotV1;
  completedStep: number;
};

export type HomogeneousTerminalRouteResult =
  | { ok: true; data: HomogeneousTerminalRoute }
  | { ok: false; conflict: BulkRoutingConflict };

function getHomogeneousRoutePosition(
  orderItems: readonly BulkRoutableItem[],
  expectedStation: OrderStation,
): HomogeneousTerminalRouteResult {
  if (orderItems.length === 0) return { ok: false, conflict: "ORDER_WITHOUT_ITEMS" };

  let commonSnapshot: RouteSnapshotV1 | null = null;
  let commonStep: number | null = null;

  for (const item of orderItems) {
    try {
      if (parseOrderStation(item.currentStationId) !== expectedStation) {
        return { ok: false, conflict: "ITEM_STATION_DIVERGENCE" };
      }
    } catch {
      return { ok: false, conflict: "ITEM_STATION_DIVERGENCE" };
    }

    const snapshot = parseRouteSnapshot(item.stationSequence);
    const step = item.currentStep;
    if (!snapshot || !Number.isInteger(step) || step === null || step < 0 || step >= snapshot.stations.length) {
      return { ok: false, conflict: "POSITION_ROUTE_REQUIRES_UNIT_ENGINE" };
    }
    if (snapshot.stations[step] !== expectedStation) {
      return { ok: false, conflict: "ITEM_STATION_DIVERGENCE" };
    }

    if (!commonSnapshot) {
      commonSnapshot = snapshot;
      commonStep = step;
    } else if (commonSnapshot.templateId !== snapshot.templateId || commonStep !== step) {
      return { ok: false, conflict: "POSITION_ROUTE_REQUIRES_UNIT_ENGINE" };
    }
  }

  if (!commonSnapshot || commonStep === null) {
    return { ok: false, conflict: "POSITION_ROUTE_REQUIRES_UNIT_ENGINE" };
  }
  return { ok: true, data: { snapshot: commonSnapshot, completedStep: commonStep } };
}

/**
 * Advances only a fully explicit v1 snapshot shared by every order item.
 * Missing/legacy arrays, split routes or divergent steps remain fail-closed;
 * those cases need unit-specific handling rather than a bulk order mutation.
 */
export function getHomogeneousRouteTransition(
  orderItems: readonly BulkRoutableItem[],
  expectedStation: OrderStation,
): HomogeneousRouteResult {
  const position = getHomogeneousRoutePosition(orderItems, expectedStation);
  if (!position.ok) return position;
  const nextStep = position.data.completedStep + 1;
  const nextValue = position.data.snapshot.stations[nextStep];
  if (!nextValue) return { ok: false, conflict: "POSITION_ROUTE_REQUIRES_UNIT_ENGINE" };

  try {
    return {
      ok: true,
      data: {
        snapshot: position.data.snapshot,
        completedStep: position.data.completedStep,
        nextStep,
        nextStation: parseOrderStation(nextValue),
      },
    };
  } catch {
    return { ok: false, conflict: "POSITION_ROUTE_REQUIRES_UNIT_ENGINE" };
  }
}

/** Confirms that every position is on the final station of one explicit v1 route. */
export function getHomogeneousTerminalRoute(
  orderItems: readonly BulkRoutableItem[],
  expectedStation: OrderStation,
): HomogeneousTerminalRouteResult {
  const position = getHomogeneousRoutePosition(orderItems, expectedStation);
  if (!position.ok) return position;
  return position.data.completedStep === position.data.snapshot.stations.length - 1
    ? position
    : { ok: false, conflict: "POSITION_ROUTE_REQUIRES_UNIT_ENGINE" };
}

export function getBulkRoutingConflict(
  orderItems: readonly BulkRoutableItem[],
  expectedStation: OrderStation,
): BulkRoutingConflict | null {
  const result = getHomogeneousRouteTransition(orderItems, expectedStation);
  return result.ok ? null : result.conflict;
}
