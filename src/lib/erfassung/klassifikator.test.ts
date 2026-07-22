import { describe, expect, it } from "vitest";
import { bildeSchluessel, klassifiziereTeil, normalizeString } from "./klassifikator";

describe("template classifier truth contract", () => {
  it("normalizes composed and decomposed German text identically", () => {
    expect(normalizeString(" Türgríff ")).toBe("tuergriff");
    expect(normalizeString("Tu\u0308rgriff")).toBe("tuergriff");
    expect(bildeSchluessel("TÜR", "Chróm")).toBe("tuer|chrom");
    expect(new Set(["tür", "tuer", "tu\u0308r"].map(normalizeString))).toEqual(new Set(["tuer"]));
  });

  it("prefers the longest literal keyword regardless of classifier row order", () => {
    expect(klassifiziereTeil("alter Türgriff", [
      { klasse: "griff", keywords: ["griff"] },
      { klasse: "tuergriff", keywords: ["tuergriff"] },
    ])).toBe("tuergriff");
    expect(klassifiziereTeil("Scheinwerferrahmen", [
      { klasse: "rahmen", keywords: ["rahmen"] },
      { klasse: "scheinwerfer", keywords: ["scheinwerferrahmen"] },
    ])).toBe("scheinwerfer");
  });

  it("never treats empty or invalid keywords as match-all", () => {
    expect(klassifiziereTeil("beliebiges teil", [
      { klasse: "invalid", keywords: [null as unknown as string, "   "] },
    ])).toBe("sonstiges");
  });
});
