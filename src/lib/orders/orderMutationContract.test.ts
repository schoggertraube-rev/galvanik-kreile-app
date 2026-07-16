import { describe, expect, it } from "vitest";
import {
  canTransitionOrderStation,
  canTransitionOrderStatus,
  getProcessTransitionConflict,
  getStateAfterStationCompletion,
  normalizeStoredOrderStatus,
  orderUpdateSchema,
  parseOrderStation,
  processTransitionSchema,
  requiredPermissionsForOrderUpdate,
} from "./orderMutationContract";

const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("order mutation contract", () => {
  it("normalizes the legacy station alias without accepting arbitrary stations", () => {
    expect(parseOrderStation("beschichtung")).toBe("galvanik");
    expect(() => parseOrderStation("weisse-wand")).toThrow();
  });

  it.each([
    { station: "warenausgang" },
    { rawDueDate: "2030-01-01" },
    { customerId: "other-customer" },
    { statusText: "erledigt" },
    { priorityComputed: "green" },
    {},
  ])("rejects ignored or empty updates %#", (update) => {
    expect(orderUpdateSchema.safeParse(update).success).toBe(false);
  });

  it("accepts only exact, bounded values", () => {
    const parsed = orderUpdateSchema.parse({
      risk: "yellow",
      title: "  Stoßfänger  ",
      task: null,
      dueDate: "2030-01-15",
    });
    expect(parsed.title).toBe("Stoßfänger");
    expect(parsed.dueDate).toBeInstanceOf(Date);
  });

  it("requires exactly one process intent", () => {
    expect(processTransitionSchema.safeParse({ orderId: "order_1" }).success).toBe(false);
    expect(processTransitionSchema.safeParse({ orderId: "order_1", clientRequestId: requestId, expectedStation: "wareneingang", action: "start", targetStep: "galvanik" }).success).toBe(false);
    expect(processTransitionSchema.safeParse({ orderId: "order_1", clientRequestId: requestId, expectedStation: "wareneingang", action: "start_at_step" }).success).toBe(false);
    expect(processTransitionSchema.safeParse({ orderId: "order_1", clientRequestId: requestId, expectedStation: "wareneingang", action: "cancel" }).success).toBe(true);
    expect(processTransitionSchema.safeParse({ orderId: "order_1", action: "complete" }).success).toBe(false);
  });

  it("binds process actions to the locked station and action-specific status", () => {
    const start = processTransitionSchema.parse({
      orderId: "order_1",
      clientRequestId: requestId,
      expectedStation: "galvanik",
      action: "start",
    });
    expect(getProcessTransitionConflict("ready", "galvanik", start)).toBeNull();
    expect(getProcessTransitionConflict("blocked", "galvanik", start)).toBe("ORDER_NOT_READY");
    expect(getProcessTransitionConflict("ready", "schleiferei", start)).toBe("STALE_ORDER_STATION");
  });

  it("uses one canonical next-state projection, including outbound shipment", () => {
    expect(getStateAfterStationCompletion("galvanik")).toEqual({
      station: "qualitaetssicherung",
      status: "ready",
      eventType: "STATION_COMPLETED",
    });
    expect(getStateAfterStationCompletion("warenausgang")).toEqual({
      station: "warenausgang",
      status: "shipped",
      eventType: "SHIPMENT_SENT",
    });
    expect(canTransitionOrderStatus("in_progress", "shipped")).toBe(true);
  });

  it("normalizes legacy stored statuses but keeps terminal states closed", () => {
    expect(normalizeStoredOrderStatus("Bereit für Versand")).toBe("ready");
    expect(normalizeStoredOrderStatus("abgeschlossen")).toBe("completed");
    expect(canTransitionOrderStatus("ready", "shipped")).toBe(true);
    expect(canTransitionOrderStatus("completed", "in_progress")).toBe(false);
  });

  it("allows only the defined forward station graph", () => {
    expect(canTransitionOrderStation("wareneingang", "galvanik")).toBe(true);
    expect(canTransitionOrderStation("galvanik", "qualitaetssicherung")).toBe(true);
    expect(canTransitionOrderStation("qualitaetssicherung", "warenausgang")).toBe(true);
    expect(canTransitionOrderStation("wareneingang", "warenausgang")).toBe(false);
    expect(canTransitionOrderStation("galvanik", "wareneingang")).toBe(false);
    expect(canTransitionOrderStation("warenausgang", "galvanik")).toBe(false);
  });

  it("derives field-level permissions for mixed order updates", () => {
    expect(requiredPermissionsForOrderUpdate({ title: "Neuer Titel" })).toEqual(["perm_data_orders"]);
    expect(requiredPermissionsForOrderUpdate({ risk: "red" })).toEqual(["perm_op_risk"]);
    expect(requiredPermissionsForOrderUpdate({
      task: null,
      risk: "orange",
    })).toEqual(["perm_data_orders", "perm_op_risk"]);
  });

  it("keeps generic order updates away from process state", () => {
    expect(orderUpdateSchema.safeParse({ status: "ready" }).success).toBe(false);
    expect(orderUpdateSchema.safeParse({ currentStationId: "galvanik" }).success).toBe(false);
    expect(orderUpdateSchema.safeParse({ title: "Gültiger Titel", status: "ready" }).success).toBe(false);
  });
});
