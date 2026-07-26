import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/app/actions/orders.actions.ts"),
  "utf8",
);

function section(start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("order action permission truth", () => {
  it("keeps read endpoints on Leitstand read permission", () => {
    expect(section("export async function getOrdersDb", "export async function getOrderCountDb"))
      .toContain('requireOrderAccess("perm_view_leitstand")');
    expect(section("export async function getOrderCountDb", "export async function createOrderDb"))
      .toContain('requireOrderAccess("perm_view_leitstand")');
    expect(section("export async function getRiskOrders", "export async function transitionOrderProcess"))
      .toContain('permissions.includes("perm_view_leitstand")');
  });

  it("separates data writes from operational status transitions", () => {
    expect(section("export async function createOrderDb", "export async function updateOrderDb"))
      .toContain('requireOrderAccess("perm_data_orders")');
    expect(section("export async function updateOrderDb", "export async function getRiskOrders"))
      .toContain("requireOrderAccess(...requiredPermissionsForOrderUpdate(parsedChanges.data))");
    expect(section("export async function transitionOrderProcess", "export async function createOrderFromScan"))
      .toContain('requireOrderAccess("perm_op_status")');
  });

  it("locks and compares the expected process state before any transition write", () => {
    const transition = section("export async function transitionOrderProcess", "export async function createOrderFromScan");
    expect(transition).toContain('.for("update")');
    expect(transition).toContain("getProcessTransitionConflict(currentStatus, storedStation, parsed.data)");
    expect(transition).toContain("STALE_ORDER_STATION");
    expect(transition).toContain("events.clientEventId");
    expect(transition).toContain("eventType: events.eventType");
    expect(transition).toContain("existingReceipt.eventType !== expectedEventType");
    expect(transition).toContain("replayed: true");
    expect(transition.indexOf("existingReceipt")).toBeLessThan(transition.indexOf("ORDER_PROCESS_LOCKED"));
    expect(transition.indexOf("getProcessTransitionConflict")).toBeLessThan(transition.indexOf(".update(orders)"));
    expect(transition).not.toContain('action === "complete"');
    expect(transition).not.toContain("getStateAfterStationCompletion");
    expect(transition).not.toContain(".update(items)");
  });

  it("keeps generic order edits away from process fields", () => {
    const update = section("export async function updateOrderDb", "export async function getRiskOrders");
    expect(update).not.toContain("updateSet.status");
    expect(update).not.toContain("updateSet.currentStationId");
    expect(update).not.toContain(".update(items)");
  });
});
