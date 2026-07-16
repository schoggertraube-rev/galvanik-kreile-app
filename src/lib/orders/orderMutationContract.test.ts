import { describe, expect, it } from "vitest";
import {
  canTransitionOrderStatus,
  normalizeStoredOrderStatus,
  orderUpdateSchema,
  processTransitionSchema,
} from "./orderMutationContract";

describe("order mutation contract", () => {
  it("normalizes the legacy station alias without accepting arbitrary stations", () => {
    expect(orderUpdateSchema.parse({ currentStationId: "beschichtung" }).currentStationId).toBe("galvanik");
    expect(orderUpdateSchema.safeParse({ currentStationId: "weisse-wand" }).success).toBe(false);
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
      status: "ready",
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
    expect(processTransitionSchema.safeParse({ orderId: "order_1", action: "start", targetStep: "galvanik" }).success).toBe(false);
    expect(processTransitionSchema.safeParse({ orderId: "order_1", action: "complete" }).success).toBe(true);
  });

  it("normalizes legacy stored statuses but keeps terminal states closed", () => {
    expect(normalizeStoredOrderStatus("Bereit für Versand")).toBe("ready");
    expect(normalizeStoredOrderStatus("abgeschlossen")).toBe("completed");
    expect(canTransitionOrderStatus("ready", "shipped")).toBe(true);
    expect(canTransitionOrderStatus("completed", "in_progress")).toBe(false);
  });
});
