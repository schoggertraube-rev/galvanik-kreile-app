import { describe, expect, it } from "vitest";
import {
  getAnalyseReturnTo,
  openAnalyseEntityLink,
  parseAnalysePeriod,
  parseAnalyseTile,
} from "./routes";

describe("analysis route contract", () => {
  it("round-trips a validated tile and period without untyped filters", () => {
    expect(getAnalyseReturnTo("werkstatt_puls", "Woche")).toBe(
      "/performance?tile=werkstatt_puls&period=Woche",
    );
    expect(parseAnalyseTile("werkstatt_puls")).toBe("werkstatt_puls");
    expect(parseAnalysePeriod("Woche")).toBe("Woche");
  });

  it("falls back safely for missing, repeated, or unsupported query values", () => {
    expect(parseAnalyseTile("not-a-tile")).toBeNull();
    expect(parseAnalyseTile(["werkstatt_puls", "umsatz_marge"])).toBeNull();
    expect(parseAnalysePeriod("Quartal")).toBe("Monat");
    expect(parseAnalysePeriod(undefined)).toBe("Monat");
  });

  it("never turns a missing or unsafe entity target into a clickable hash link", () => {
    const base = {
      id: "order-1",
      label: "Auftrag 1",
      type: "order" as const,
      returnTo: "/performance",
    };
    expect(openAnalyseEntityLink(base)).toBeNull();
    expect(openAnalyseEntityLink({ ...base, href: "/orders/order-1" })).toBe("/orders/order-1");
    expect(openAnalyseEntityLink({ ...base, href: "/%2f%2fevil.example" })).toBeNull();
  });
});
