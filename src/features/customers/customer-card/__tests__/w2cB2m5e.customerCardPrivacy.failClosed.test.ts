import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addCustomerTag,
  getCustomerCard,
  getCustomerComplaints,
  getCustomerFinancials,
  getCustomerItems,
  getCustomerOrders,
  getCustomerPrices,
  getCustomerSimilarOrders,
  getCustomerTimeline,
  removeCustomerTag,
  updateCustomerCore,
} from "../customerCard.actions";

const message = "NOT_AVAILABLE: Die Kundenakte benötigt einen tenant- und ownership-geprüften W3-Read-/Command-Vertrag.";
const denial = { ok: false, error: "NOT_AVAILABLE", message };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("W2C-B2M5E customer-card privacy containment", () => {
  it("denies every public read and command without success data or runtime side effects", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const calls = [
      getCustomerCard("foreign-customer"),
      getCustomerOrders("foreign-customer"),
      getCustomerTimeline("foreign-customer"),
      getCustomerFinancials("foreign-customer"),
      getCustomerSimilarOrders("foreign-customer", "foreign-order"),
      getCustomerItems("foreign-customer"),
      getCustomerPrices("foreign-customer"),
      getCustomerComplaints("foreign-customer"),
      updateCustomerCore("foreign-customer", { internalNotes: "foreign patch" }),
      addCustomerTag("foreign-customer", "foreign-tag"),
      removeCustomerTag("foreign-customer", "foreign-tag"),
    ];

    const results = await Promise.all(calls);

    for (const result of results) {
      expect(result).toEqual(denial);
      expect(result.ok).toBe(false);
      expect(result).not.toHaveProperty("data");
      expect(result).not.toEqual(expect.objectContaining({ data: expect.anything() }));
    }
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("keeps only type imports and no executable data, auth, time, or logging port", async () => {
    const source = await readFile(resolve(process.cwd(), "src/features/customers/customer-card/customerCard.actions.ts"), "utf8");
    const executableSource = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const importLines = executableSource.split("\n").filter((line) => line.trimStart().startsWith("import"));
    const runtimeSource = executableSource.replace(/^import[^;]+;\s*$/gm, "");
    const actionBodies = [...runtimeSource.matchAll(/export async function [^{]+\{([\s\S]*?)\n\}/g)].map(([, body]) => body);

    expect(importLines).not.toHaveLength(0);
    expect(importLines.every((line) => line.trimStart().startsWith("import type "))).toBe(true);
    expect(runtimeSource).not.toMatch(/\b(db|checkAppAuth|Date|sql|events|select|execute|update|insert|transaction|console)\b/);
    expect(actionBodies).toHaveLength(11);
    for (const body of actionBodies) {
      expect(body).not.toMatch(/ok\s*:\s*true|data\s*:\s*(\[\s*\]|null|0)/);
      expect(body).toMatch(/return unavailable\(\);/);
    }
    expect(executableSource).toContain('error: "NOT_AVAILABLE"');
    expect(executableSource).toContain(`const NOT_AVAILABLE_MESSAGE = "${message}"`);
  });
});
