import { describe, expect, it } from "vitest";
import { feinmetallAusBadanalyse, feinmetallAusBewegung } from "../metallmenge";

describe("Metallmengen", () => {
  it("rechnet Feingehalt und Bewegungsrichtung exakt", () => {
    expect(feinmetallAusBewegung("1000", "68.3")).toBe("683");
    expect(feinmetallAusBewegung("-0.001", "99.99")).toBe("-0.0009999");
    expect(feinmetallAusBewegung("0", "100")).toBe("0");
  });

  it("bewahrt fehlende Angaben als unbekannt und weist ungültige Werte ab", () => {
    expect(feinmetallAusBewegung(null, "100")).toBeNull();
    expect(feinmetallAusBewegung("0", null)).toBeNull();
    expect(() => feinmetallAusBewegung("1", "100.001")).toThrow("INVALID_METAL_PURITY");
  });

  it("berechnet Badanalysen ohne Rundungs- oder Nullersatz", () => {
    expect(feinmetallAusBadanalyse("0.125", "12.5")).toBe("1.5625");
    expect(feinmetallAusBadanalyse("0", "12.5")).toBe("0");
    expect(feinmetallAusBadanalyse("0", null)).toBeNull();
    expect(() => feinmetallAusBadanalyse("-1", "12.5")).toThrow("INVALID_METAL_QUANTITY");
    expect(() => feinmetallAusBadanalyse("1e-3", "12.5")).toThrow("INVALID_METAL_QUANTITY");
  });
});
