import { describe, expect, it } from "vitest";
import { quantityInputValue } from "./ItemsSection";

describe("editable item quantity truth", () => {
  it("keeps missing and invalid quantities empty instead of inventing a number", () => {
    expect(quantityInputValue(undefined)).toBe("");
    expect(quantityInputValue(null)).toBe("");
    expect(quantityInputValue("")).toBe("");
    expect(quantityInputValue("   ")).toBe("");
    expect(quantityInputValue(Number.NaN)).toBe("");
    expect(quantityInputValue("not-a-number")).toBe("");
  });

  it("preserves explicit finite quantities, including invalid-for-save zero", () => {
    expect(quantityInputValue(1)).toBe(1);
    expect(quantityInputValue("12")).toBe(12);
    expect(quantityInputValue(0)).toBe(0);
  });
});
