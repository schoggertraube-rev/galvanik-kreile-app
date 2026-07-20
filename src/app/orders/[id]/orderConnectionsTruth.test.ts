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
    const invoicePage = source("src/app/buchhaltung/rechnungen/[id]/page.tsx");
    const financeActions = source("src/app/buchhaltung/actions.ts");
    expect(page).not.toContain("parseInt(order.orderNumber");
    expect(page).not.toContain("RE-{new Date().getFullYear()}");
    expect(page).not.toContain("Empfehlung / Bestandskunde");
    expect(page).toContain("getOrderConnections");
    expect(invoicePage).toContain("rechnung.orderId");
    expect(invoicePage).toContain("Kein Auftrag verknüpft");
    expect(invoicePage).not.toContain('rechnung.nummer.replace("RE-", "")');
    expect(financeActions).toContain("FINANCE_ORDER_CUSTOMER_MISMATCH");
    expect(financeActions).toContain("orderId: optionalString(dbData, 'order_id')");
    expect(financeActions).toContain("readInvoiceCreateCapability");
    expect(financeActions).toContain("pg_advisory_xact_lock");
    expect(financeActions).toContain("id: clientRequestId");
    expect(financeActions).toContain("FINANCE_REQUEST_CONFLICT");
    const form = source("src/app/buchhaltung/rechnungen/neu/RechnungForm.tsx");
    expect(form).toContain('fd.append("clientRequestId", clientRequestId)');
    expect(form).toContain('fd.append("orderId", orderId)');
    expect(form).toContain("writeCapability.available");
  });
});
