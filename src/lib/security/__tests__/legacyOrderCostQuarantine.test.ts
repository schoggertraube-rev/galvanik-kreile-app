import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const sourceRoots = [join(root, "src", "app"), join(root, "src", "components")];
const allowedLegacyClosure = new Set([
  "src/components/orders/StationContextBlock.tsx",
  "src/components/orders/variants/ErfassungVariant.tsx",
  "src/components/orders/variants/WareneingangReadOnly.tsx",
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : [".ts", ".tsx"].includes(extname(entry.name))
        ? [path]
        : [];
  });
}

describe("legacy order-cost quarantine", () => {
  it("keeps the demo-only partial-commit UI outside every production route graph", () => {
    const violations = sourceRoots
      .flatMap(sourceFiles)
      .map((path) => ({
        path: relative(root, path).replaceAll("\\", "/"),
        source: readFileSync(path, "utf8"),
      }))
      .filter(({ path }) => !allowedLegacyClosure.has(path))
      .filter(({ source }) =>
        source.includes("StationContextBlock")
        || source.includes("variants/ErfassungVariant")
        || source.includes("features/orders/orderCost.actions"))
      .map(({ path }) => path);

    expect(violations).toEqual([]);
  });

  it("binds active order capture to the canonical server-confirmed path", () => {
    const detail = readFileSync(join(root, "src/app/orders/[id]/page.tsx"), "utf8");
    const modal = readFileSync(join(root, "src/components/orders/StationCompletionModal.tsx"), "utf8");
    expect(detail).toContain('import { CaptureCard }');
    expect(detail).not.toContain("StationContextBlock");
    expect(modal).toContain("completeStationCapture");
    expect(modal).not.toContain("bookStationCosts");
  });

  it("keeps the quarantined legacy server actions fail closed and side-effect free", () => {
    const actions = readFileSync(join(root, "src/features/orders/orderCost.actions.ts"), "utf8");
    const legacyVariant = readFileSync(
      join(root, "src/components/orders/variants/ErfassungVariant.tsx"),
      "utf8",
    );

    expect(actions).toContain("LEGACY_ORDER_COST_FLOW_RETIRED");
    expect(actions).toContain("success: false");
    expect(actions).not.toContain("createClient");
    expect(actions).not.toContain("db.transaction");
    expect(actions).not.toContain(".insert(");
    expect(legacyVariant).toContain("!benchRes.available || !summaryRes.available");
    expect(legacyVariant).not.toContain("00000000-0000-0000-0000-000000000000");
  });
});
