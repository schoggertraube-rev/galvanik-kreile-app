import { describe, expect, it } from "vitest";
import { getUrgency } from "@/lib/orders/getUrgency";

describe("W2C-B2M5U urgency date truth", () => {
  it("returns unknown for no usable date", () => {
    for (const dueDate of [null, "", "  ", "invalid"]) expect(getUrgency(dueDate)).toBe("unknown");
  });
  it("retains valid critical behavior", () => expect(getUrgency("2000-01-01")).toBe("kritisch"));
});
