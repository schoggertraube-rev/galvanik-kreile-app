import { describe, expect, it } from "vitest";
import { zeigeFertigtermin } from "@/modules/orders/public";

const kalender = { betriebsruhe: new Set<string>(), versandpufferArbeitstage: 0, knappAbArbeitstagen: 2 };
const heute = "2026-11-26";
const termin = (dueDate: string | null, blocked = false) =>
  zeigeFertigtermin({ dueDate, handoverMode: "pickup" }, kalender, heute, blocked);

describe("W2C-B2M5U priority date truth", () => {
  it("fails closed for absent or invalid dates while preserving blocked", () => {
    for (const dueDate of [null, "", "   ", "not-a-date"]) {
      expect(termin(dueDate).risk).toBe("unknown");
    }
    expect(termin(null, true)).toMatchObject({ risk: "blocked", statusText: "Wartet auf Freigabe" });
  });
  it("keeps valid today behavior", () => expect(termin(heute).dueValue).toBe("Heute fällig"));
});
