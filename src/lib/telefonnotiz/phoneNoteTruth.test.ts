import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { performLocalAnalysis } from "@/lib/localPhoneAnalysis";
import type { Customer } from "@/lib/repositories/customersRepository";
import type { Order } from "@/lib/repositories/ordersRepository";

const root = process.cwd();

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

const customer: Customer = {
  id: "customer-1",
  customerNumber: "K-1",
  name: "Müller Metallbau",
  type: "Geschäftskunde",
  city: "Hamburg",
};

const order: Order = {
  id: "order-1",
  orderNumber: "A-2026-0107",
  customerId: customer.id,
  title: "Geländer vernickeln",
  task: "Geländer vernickeln",
  station: "galvanik",
  status: "in_progress",
  statusText: "In Arbeit",
  risk: "low",
  parts: [],
};

describe("Telefonnotiz truth boundary", () => {
  it("matches only supplied repository facts and never claims calendar availability", () => {
    const result = performLocalAnalysis(
      "Müller Metallbau fragt zu A-2026-0107 und möchte morgen abholen.",
      [customer],
      [order],
    );
    expect(result.matchedCustomer?.id).toBe(customer.id);
    expect(result.matchedOrder?.id).toBe(order.id);
    expect(result.matchedTime?.availability).toBe("not_checked");
    expect(result.suggestedAnswer).toContain("In Arbeit");
  });

  it("does not invent a customer, order, payment balance, stock, or free slot", () => {
    const result = performLocalAnalysis("Unbekannter Anrufer möchte morgen Zinkteile abholen.", [], []);
    expect(result.matchedCustomer).toBeNull();
    expect(result.matchedOrder).toBeNull();
    expect(result.matchedTime?.availability).toBe("not_checked");
    expect(result.matchedPayment).toBeNull();

    const context = source("src/hooks/useLiveContext.ts");
    for (const fabricated of ["Kunde seit 2019", "248,00 €", "pünktlich", "% voll", "frei ✓"]) {
      expect(context).not.toContain(fabricated);
    }
    expect(context).toContain("nicht angebunden");
  });

  it("persists exactly once and checks the write receipt before showing success", () => {
    const desktop = source("src/components/telefonnotiz/TelefonnotizDesktop.tsx");
    expect(desktop.match(/createPhoneNote\(/g)).toHaveLength(1);
    expect(desktop).toContain("if (!res.success)");
    expect(desktop).toContain("Folgeaktionen wurden nicht automatisch ausgeführt");
    for (const fake of ["sessionStorage", "showEmailMock", "Alle Aktionen ausgeführt", "grüne Aktionen sofort anwenden", "alert("]) {
      expect(desktop).not.toContain(fake);
    }
  });

  it("uses the authorized metered AI boundary only on explicit request", () => {
    const action = source("src/app/actions/analyzePhoneNote.ts");
    const hook = source("src/hooks/usePhoneNoteAnalysis.ts");
    expect(action).toContain("resolveAuthorization");
    expect(action).toContain("perm_data_orders");
    expect(action).toContain("proxyMeteredAiRequest");
    expect(action).toContain("parsePhoneNoteAnalysisResult");
    expect(action).not.toContain("generateGeminiContentWithFallback");
    expect(hook).toContain("const requestAi = useCallback");
    expect(hook).not.toContain("setTimeout(async");
    expect(hook).not.toContain("INITIAL_CUSTOMERS");
  });

  it("validates model output before recording a successful AI settlement", () => {
    const edge = source("supabase/functions/notes-extract/index.ts");
    const parseIndex = edge.indexOf("const result = parsePhoneNoteResult(generated.result)");
    const settleIndex = edge.indexOf('outcome: "succeeded"');
    expect(parseIndex).toBeGreaterThan(-1);
    expect(settleIndex).toBeGreaterThan(parseIndex);
  });

  it("keeps phone-note writes authorized, tenant-scoped, and receipt-backed", () => {
    const action = source("src/app/actions/phoneNotes.actions.ts");
    expect(action).toContain("resolveAuthorization");
    expect(action).toContain("phoneNotes.tenantId");
    expect(action).toContain("db.transaction");
    expect(action).toContain("createdBy: actor.data.userId");
    expect(action).toContain(".returning()");
    expect(action).not.toContain("tenantId: input");
  });
});
