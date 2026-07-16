import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/lib/server/operationalOrders.ts"),
  "utf8",
);

function serviceSection(start: string, end?: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = end ? source.indexOf(end, startIndex + start.length) : source.length;
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("operational order transition exclusivity", () => {
  it("does not expose a second station-move or station-start writer", () => {
    expect(source).not.toContain("export async function moveOperationalOrderToStationService");
    expect(source).not.toContain("export async function startProcessingStationService");
    expect(source).not.toContain(".update(items)");
  });

  it("keeps creation atomic with its initial items", () => {
    const create = serviceSection("export async function createOperationalOrderService");
    expect(create).toContain("db.transaction");
    expect(create).toContain("ORDER_ITEMS_NOT_CONFIRMED");
  });
});
