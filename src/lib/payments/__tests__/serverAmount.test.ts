import { describe, expect, it } from "vitest";
import { sumPriceLinesCents } from "@/lib/payments/serverAmount";

describe("sumPriceLinesCents", () => {
  it("uses generated totals and exact decimal fallback", () => {
    expect(sumPriceLinesCents([
      { qty: "1.00", unitPriceEur: "10.00", unitTotalEur: "10.00" },
      { qty: "2.50", unitPriceEur: "3.20", unitTotalEur: null },
    ])).toBe(1800);
  });

  it("rejects zero, negative, malformed, and over-precise values", () => {
    expect(() => sumPriceLinesCents([])).toThrow("INVALID_PAYMENT_AMOUNT");
    expect(() => sumPriceLinesCents([
      { qty: "1", unitPriceEur: "1.001", unitTotalEur: null },
    ])).toThrow("INVALID_PAYMENT_AMOUNT");
    expect(() => sumPriceLinesCents([
      { qty: "1", unitPriceEur: "-1.00", unitTotalEur: null },
    ])).toThrow("INVALID_PAYMENT_AMOUNT");
  });
});
