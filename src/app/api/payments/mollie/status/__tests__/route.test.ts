import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockResolveAuthorization, mockDbSelect } = vi.hoisted(() => ({
  mockResolveAuthorization: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: mockResolveAuthorization }));
vi.mock("@/db", () => ({ db: { select: mockDbSelect } }));
vi.mock("@/db/schema", () => ({
  payments: {
    tenantId: "payments.tenant_id",
    providerIntentId: "payments.provider_intent_id",
    status: "payments.status",
    mollieStatus: "payments.mollie_status",
  },
}));
vi.mock("drizzle-orm", () => ({ and: vi.fn(), eq: vi.fn() }));

import { GET } from "@/app/api/payments/mollie/status/route";

const actor = {
  userId: "admin-user",
  tenantId: "galvanik-kreile",
  displayName: "Admin",
  role: "admin",
  permissions: ["perm_view_prices"],
  active: true,
};

function selectRows(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({ limit: vi.fn(async () => rows) })),
    })),
  };
}

describe("Mollie local status boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveAuthorization.mockResolvedValue({ ok: true, data: actor });
  });

  it("rejects unauthenticated or malformed lookups before database access", async () => {
    mockResolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "NO_SESSION" });
    expect((await GET(new Request("http://localhost/api/payments/mollie/status?intentId=tr_payment123"))).status)
      .toBe(401);
    expect((await GET(new Request("http://localhost/api/payments/mollie/status?intentId=bad"))).status)
      .toBe(400);
    expect((await GET(new Request("http://localhost/api/payments/mollie/status?intentId=tr_a&intentId=tr_b"))).status)
      .toBe(400);
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it("returns only the tenant-local stored status", async () => {
    mockDbSelect.mockReturnValue(selectRows([{ status: "pending", providerStatus: "open" }]));
    const response = await GET(new Request(
      "http://localhost/api/payments/mollie/status?intentId=tr_payment123",
    ));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      status: "pending",
      providerStatus: "open",
    });
  });

  it("fails closed on duplicate provider identities", async () => {
    mockDbSelect.mockReturnValue(selectRows([
      { status: "pending", providerStatus: "open" },
      { status: "paid", providerStatus: "paid" },
    ]));
    expect((await GET(new Request(
      "http://localhost/api/payments/mollie/status?intentId=tr_payment123",
    ))).status).toBe(409);
  });
});
