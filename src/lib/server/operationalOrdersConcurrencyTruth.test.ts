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

  it("locks and links a confirmed capture receipt in the same order transaction", () => {
    const create = serviceSection("export async function createOperationalOrderService");
    expect(create).toContain("isConfirmedCaptureReceipt(scan, actor.tenantId)");
    expect(create).toContain('scanUploads.recordKind, "capture_scan"');
    expect(create).toContain('.limit(1).for("update")');
    expect(create).toContain("tx.update(scanUploads)");
    expect(create).toContain("SCAN_LINK_RECEIPT_MISSING");
    expect(create).toContain("scanOriginalReceipt");
    expect(create.indexOf("tx.update(scanUploads)")).toBeLessThan(create.indexOf("tx.insert(events)"));
  });

  it("requires the persisted scan relation when replaying a confirmed order receipt", () => {
    const replay = serviceSection("async function findOrderCreationReplay", "export async function createOperationalOrderService");
    expect(replay).toContain("isConfirmedCaptureReceipt(scan, tenantId)");
    expect(replay).toContain("scan.linkedOrderId !== order.id");
    expect(replay).toContain("scan.linkedCustomerId !== order.customerId");
    expect(replay).toContain("ORDER_RECEIPT_WITHOUT_SCAN_LINK");
  });

  it("stores bounded route evidence instead of one duplicate entry per part", () => {
    const create = serviceSection("export async function createOperationalOrderService");
    expect(create).toContain("routeTemplateIds: [...new Set(");
    expect(create).not.toContain("routeTemplates: validData.parts.map");
  });

  it("writes canonical creation events while retaining legacy replay compatibility", () => {
    const create = serviceSection("export async function createOperationalOrderService");
    const replay = serviceSection("async function findOrderCreationReplay", "export async function createOperationalOrderService");
    expect(create).toContain('"ORDER_CREATED_FROM_SCAN"');
    expect(create).toContain('"ORDER_CREATED_MANUAL"');
    expect(replay).toContain('"ORDER_CREATED"');
  });
});
