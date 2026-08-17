import { describe, expect, it } from "vitest";
import { evaluateOrderPriority } from "@/lib/priority";

describe("W2C-B2M5U priority date truth", () => {
  it("fails closed for absent or invalid dates while preserving blocked", () => {
    for (const dueDate of [null, "", "   ", "not-a-date"]) {
      expect(evaluateOrderPriority({ dueDate }).risk).toBe("unknown");
    }
    expect(evaluateOrderPriority({ dueDate: "", isBlocked: true })).toMatchObject({ risk: "blocked", statusText: "WARTET AUF FREIGABE" });
  });
  it("keeps valid today behavior", () => expect(evaluateOrderPriority({ dueDate: new Date().toISOString() }).dueValue).toBe("Heute"));
});
