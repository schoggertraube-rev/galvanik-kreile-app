import { describe, expect, it } from "vitest";
import { safeReturnTo } from "@/lib/navigation/safeReturnTo";
import { buildHighlightedHtml } from "@/lib/security/highlightHtml";

describe("safeReturnTo", () => {
  it("accepts only internal relative paths", () => {
    expect(safeReturnTo("/orders/1?tab=a#top", "/")).toBe("/orders/1?tab=a#top");
    for (const value of [
      "https://evil.example",
      "//evil.example/path",
      "/%2f%2fevil.example",
      "/\\evil.example",
      "/%5cevil.example",
    ]) {
      expect(safeReturnTo(value, "/fallback")).toBe("/fallback");
    }
  });
});

describe("buildHighlightedHtml", () => {
  it("escapes source HTML before adding owned mark tags", () => {
    const html = buildHighlightedHtml('<img src=x onerror="alert(1)"> Kunde', [
      { word: "Kunde", type: "kunde" },
    ]);
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain('<mark class="kunde">Kunde</mark>');
    expect(html).not.toContain("<img");
  });
});
