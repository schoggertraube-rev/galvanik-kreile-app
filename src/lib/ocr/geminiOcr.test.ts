import { describe, expect, it } from "vitest";
import { parseOcrResponse } from "@/lib/ocr/geminiOcr";

describe("parseOcrResponse", () => {
  it("accepts bounded structured evidence without inventing missing fields", () => {
    const result = parseOcrResponse(JSON.stringify({
      Kundenname: " Michael Muster ",
      Artikelbeschreibung: " Stoßstange ",
      Stueckzahl: 2,
    }));
    expect(result.customerName).toBe("Michael Muster");
    expect(result.articleDescription).toBe("Stoßstange");
    expect(result.quantity).toBe(2);
    expect(result.material).toBeUndefined();
  });

  it.each([
    "",
    "not json",
    "[]",
    "{}",
    JSON.stringify({ Stueckzahl: 0 }),
    JSON.stringify({ Stueckzahl: 1.5 }),
  ])("rejects empty, malformed, or non-actionable model output %#", (raw) => {
    expect(() => parseOcrResponse(raw)).toThrow();
  });
});
