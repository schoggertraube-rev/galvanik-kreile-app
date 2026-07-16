import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockResolveAuthorization, mockDbSelect, mockFetch } = vi.hoisted(() => ({
  mockResolveAuthorization: vi.fn(),
  mockDbSelect: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: mockResolveAuthorization }));
vi.mock("@/db", () => ({ db: { select: mockDbSelect } }));
vi.mock("@/db/schema", () => ({
  orders: {
    id: "orders.id",
    orderNumber: "orders.order_number",
    customerId: "orders.customer_id",
    tenantId: "orders.tenant_id",
  },
  priceLines: {
    orderId: "price_lines.order_id",
    tenantId: "price_lines.tenant_id",
    qty: "price_lines.qty",
    unitPriceEur: "price_lines.unit_price_eur",
    unitTotalEur: "price_lines.unit_total_eur",
  },
}));
vi.mock("drizzle-orm", () => ({ and: vi.fn(), eq: vi.fn() }));

import { POST } from "@/app/api/payments/mollie/create/route";

const admin = {
  userId: "admin-user",
  tenantId: "galvanik-kreile",
  displayName: "Admin",
  role: "admin",
  permissions: ["perm_view_prices"],
  active: true,
};

function selectResult(value: unknown, withLimit: boolean) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => withLimit ? { limit: vi.fn(async () => value) } : Promise.resolve(value)),
    })),
  };
}

describe("Mollie creation authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPABASE_URL", "https://tenant.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects missing sessions and readonly users before parsing or external calls", async () => {
    mockResolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "NO_SESSION" });
    const invalidRequest = new Request("http://localhost/api/payments/mollie/create", {
      method: "POST",
      body: "{invalid",
    });
    expect((await POST(invalidRequest)).status).toBe(401);

    mockResolveAuthorization.mockResolvedValueOnce({
      ok: true,
      data: { ...admin, role: "readonly", permissions: [] },
    });
    expect((await POST(new Request("http://localhost/api/payments/mollie/create", {
      method: "POST",
      body: "{invalid",
    }))).status).toBe(403);

    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("keeps an entitled path operational while forwarding only the server-selected order", async () => {
    mockResolveAuthorization.mockResolvedValue({ ok: true, data: admin });
    mockDbSelect
      .mockReturnValueOnce(selectResult([{
        id: "order-42",
        orderNumber: "A-2026-0042",
        customerId: "customer-1",
      }], true))
      .mockReturnValueOnce(selectResult([{
        qty: "1.00",
        unitPriceEur: "120.50",
        unitTotalEur: "120.50",
      }], false));
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      intentId: "tr_payment123",
      checkoutUrl: "https://www.mollie.com/checkout/example",
    }), { status: 200 }));

    const response = await POST(new Request("http://localhost/api/payments/mollie/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-42" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      intentId: "tr_payment123",
      checkoutUrl: "https://www.mollie.com/checkout/example",
      amountCents: 12050,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ orderId: "order-42" });
    expect(init.cache).toBe("no-store");
  });

  it("rejects client-supplied amount fields", async () => {
    mockResolveAuthorization.mockResolvedValue({ ok: true, data: admin });
    const response = await POST(new Request("http://localhost/api/payments/mollie/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-42", amount: "0.01" }),
    }));
    expect(response.status).toBe(400);
    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not forward an attacker-controlled checkout host", async () => {
    mockResolveAuthorization.mockResolvedValue({ ok: true, data: admin });
    mockDbSelect
      .mockReturnValueOnce(selectResult([{
        id: "order-42",
        orderNumber: "A-2026-0042",
        customerId: "customer-1",
      }], true))
      .mockReturnValueOnce(selectResult([{
        qty: "1.00",
        unitPriceEur: "120.50",
        unitTotalEur: "120.50",
      }], false));
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      intentId: "tr_payment123",
      checkoutUrl: "https://www.mollie.com.attacker.example/checkout",
    }), { status: 200 }));

    const response = await POST(new Request("http://localhost/api/payments/mollie/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: "order-42" }),
    }));
    expect(response.status).toBe(502);
  });
});
