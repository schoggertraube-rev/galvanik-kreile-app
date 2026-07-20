import { describe, expect, it } from "vitest";
import {
  calculateNextInventoryStock,
  fitsInventoryQuantityDecimals,
  parseInventoryMovementQuantity,
  parseStoredInventoryStock,
} from "./inventoryMutationContract";

describe("inventory mutation contract", () => {
  it("accepts at most four decimal places and rejects ambiguous quantities", () => {
    expect(parseInventoryMovementQuantity(1.2345)).toBe(1.2345);
    expect(parseInventoryMovementQuantity(-0.0001)).toBe(-0.0001);
    expect(parseInventoryMovementQuantity(1.23456)).toBeNull();
    expect(parseInventoryMovementQuantity(0)).toBeNull();
    expect(parseInventoryMovementQuantity("1")).toBeNull();
    expect(parseInventoryMovementQuantity(Number.NaN)).toBeNull();
  });

  it("fails closed for missing or invalid stored stock", () => {
    expect(parseStoredInventoryStock("10.5000")).toBe(10.5);
    expect(parseStoredInventoryStock(null)).toBeNull();
    expect(parseStoredInventoryStock("")).toBeNull();
    expect(parseStoredInventoryStock("NaN")).toBeNull();
    expect(parseStoredInventoryStock(-1)).toBeNull();
  });

  it("calculates stock with fixed four-decimal precision and never goes negative", () => {
    expect(calculateNextInventoryStock("0.3", -0.2)).toBe(0.1);
    expect(calculateNextInventoryStock("1.0000", 0.0001)).toBe(1.0001);
    expect(calculateNextInventoryStock("0.1000", -0.1001)).toBeNull();
    expect(calculateNextInventoryStock(null, 1)).toBeNull();
  });

  it("honours the server-confirmed database quantity scale", () => {
    expect(fitsInventoryQuantityDecimals(2, 0)).toBe(true);
    expect(fitsInventoryQuantityDecimals(2.5, 0)).toBe(false);
    expect(fitsInventoryQuantityDecimals(2.5, 1)).toBe(true);
    expect(fitsInventoryQuantityDecimals(0.0001, 4)).toBe(true);
    expect(fitsInventoryQuantityDecimals(0.00001, 4)).toBe(false);
  });
});
