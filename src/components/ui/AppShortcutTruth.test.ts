import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/ui/AppShortcutOverlay.tsx"),
  "utf8",
);

describe("global shortcut truth contract", () => {
  it("does not expose placeholder alerts as active actions", () => {
    expect(source).not.toContain("alert(");
    expect(source).not.toContain("(Demo)");
  });

  it("marks both missing contracts as visibly not configured and natively disabled", () => {
    expect(source.match(/contextChip="Nicht eingerichtet"/g)).toHaveLength(2);
    expect(source.match(/\n\s+disabled\n/g)).toHaveLength(2);
    expect(source).toContain("PDF- und Excel-Import sind noch nicht technisch angebunden.");
    expect(source).toContain("Die Umwandlung eines Gast-Auftrags ist noch nicht technisch angebunden.");
  });
});
