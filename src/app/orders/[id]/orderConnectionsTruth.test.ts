import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("order detail connection truth", () => {
  it("binds every connection to the authorized tenant and order", () => {
    const action = source("src/app/orders/[id]/orderConnections.actions.ts");
    expect(action).toContain("resolveAuthorization");
    expect(action).toContain("orders.tenantId");
    expect(action).toContain("qs.tenantId");
    expect(action).toContain("ausgangsrechnung.tenantId");
    expect(action).toContain("inquiries.tenantId");
    expect(action).toContain("marketingTouchpoints.tenantId");
    expect(action).toContain("ausgangsrechnung.orderId");
    expect(action).toContain("qs.orderId");
    expect(action).toContain('permissions.includes("perm_op_qa")');
    expect(action).toContain('permissions.includes("perm_view_prices")');
    expect(action).toContain('permissions.includes("perm_view_customers")');
    expect(action).toContain('quality: canViewQuality ? "available" : "forbidden"');
  });

  it("does not derive QS, invoice or marketing values from display identifiers", () => {
    const page = source("src/app/orders/[id]/page.tsx");
    expect(page).not.toContain("parseInt(order.orderNumber");
    expect(page).not.toContain("RE-{new Date().getFullYear()}");
    expect(page).not.toContain("Empfehlung / Bestandskunde");
    expect(page).toContain("getOrderConnections");
  });
});
