import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockResolveAuthorization } = vi.hoisted(() => ({
  mockResolveAuthorization: vi.fn(),
}));

vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: mockResolveAuthorization,
}));

import {
  assertFinanceDateRange,
  requireFinanceRead,
} from "@/lib/server/financeAuthorization";

const authorized = {
  userId: "user-admin",
  tenantId: "galvanik-kreile",
  displayName: "Admin",
  role: "admin",
  permissions: ["perm_view_prices"],
  active: true,
} as const;

describe("finance authorization boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fails closed for missing sessions, wrong tenants, and missing finance permission", async () => {
    mockResolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "NO_SESSION" });
    await expect(requireFinanceRead()).rejects.toThrow("AUTH_ERROR: Forbidden");

    mockResolveAuthorization.mockResolvedValueOnce({
      ok: true,
      data: { ...authorized, tenantId: "other-tenant" },
    });
    await expect(requireFinanceRead()).rejects.toThrow("AUTH_ERROR: Forbidden");

    mockResolveAuthorization.mockResolvedValueOnce({
      ok: true,
      data: { ...authorized, role: "readonly", permissions: [] },
    });
    await expect(requireFinanceRead()).rejects.toThrow("AUTH_ERROR: Forbidden");
  });

  it("returns the current database-backed finance actor", async () => {
    mockResolveAuthorization.mockResolvedValue({ ok: true, data: authorized });
    await expect(requireFinanceRead()).resolves.toEqual(authorized);
  });

  it("accepts one reporting year and rejects malformed, reversed, or over-wide ranges", () => {
    expect(() => assertFinanceDateRange("2026-01-01", "2026-12-31")).not.toThrow();
    expect(() => assertFinanceDateRange("2026-02-30", "2026-03-01")).toThrow("INVALID_DATE_RANGE");
    expect(() => assertFinanceDateRange("2026-06-02", "2026-06-01")).toThrow("INVALID_DATE_RANGE");
    expect(() => assertFinanceDateRange("2025-01-01", "2026-12-31")).toThrow("INVALID_DATE_RANGE");
  });
});
