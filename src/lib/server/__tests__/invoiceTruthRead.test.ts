import { beforeEach, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

const { execute, withTransaction } = vi.hoisted(() => ({
  execute: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({
  sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }),
}));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: withTransaction }));

const authorization = {
  userId: "11111111-1111-4111-8111-111111111111",
  tenantId: KREILE_TENANT_SLUG,
  displayName: "Synthetischer Prüfer",
  role: "meister" as const,
  permissions: ["perm_view_prices"] as const,
  active: true as const,
};

describe("invoice truth read", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withTransaction.mockImplementation(async (_authorization, work) => work({ execute }));
  });

  it("reads issued invoices from the canonical invoices table", async () => {
    execute.mockResolvedValueOnce([{
      id: "22222222-2222-4222-8222-222222222222",
      invoice_number: "R-2026-0002",
      customer_id: "customer-1",
      order_id: "order-1",
      status: "issued",
      net_amount_cents: 7500,
      vat_rate_basis_points: 1900,
      vat_amount_cents: 1425,
      gross_amount_cents: 8925,
      due_date: "2026-11-10",
      issued_at: "2026-10-28T10:00:00.000Z",
      payment_status: "bezahlt",
      payment_paid_amount_cents: 8925,
      payment_open_amount_cents: 0,
    }]);
    const { readInvoiceTruth } = await import("../invoiceTruthRead");
    await expect(readInvoiceTruth(authorization, { customerId: "customer-1" })).resolves.toEqual({
      code: "OK",
      data: [expect.objectContaining({
        invoiceNumber: "R-2026-0002",
        grossAmountCents: 8925,
        paymentStatus: "bezahlt",
        openAmountCents: 0,
      })],
    });
    expect(execute.mock.calls[0]?.[0].text).toContain("FROM public.invoices invoice");
    expect(execute.mock.calls[0]?.[0].text).not.toContain("ausgangsrechnung");
  });

  it("denies the read without the money view permission", async () => {
    const { readInvoiceTruth } = await import("../invoiceTruthRead");
    await expect(readInvoiceTruth({ ...authorization, permissions: [] })).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(withTransaction).not.toHaveBeenCalled();
  });
});
