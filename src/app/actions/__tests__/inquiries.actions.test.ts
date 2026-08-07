import { beforeEach, describe, expect, it, vi } from "vitest";

// Negative authorization tests for B1 (inquiries server actions).
// They prove the fail-closed guards: an unauthenticated/forbidden caller
// must never reach the database.

const mockCheckAppAuth = vi.fn();
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}));

vi.mock("@/db/schema", () => ({
  inquiries: {
    id: "inquiries.id",
    status: "inquiries.status",
    createdAt: "inquiries.created_at",
  },
}));

vi.mock("@/lib/server/authHelper", () => ({
  checkAppAuth: mockCheckAppAuth,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((column: unknown, value: unknown) => ({ kind: "eq", column, value })),
  count: vi.fn(() => ({ kind: "count" })),
}));

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(() => "test-generated-id"),
}));

const unauthorized = {
  ok: false as const,
  error: "UNAUTHORIZED",
  message: "Nicht angemeldet",
};

describe("inquiries actions — fail-closed authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAppAuth.mockResolvedValue(unauthorized);
  });

  it("getInquiries returns [] and never reads the DB without a valid session", async () => {
    const { getInquiries } = await import("@/app/actions/inquiries.actions");

    await expect(getInquiries()).resolves.toEqual([]);
    expect(mockCheckAppAuth).toHaveBeenCalledWith("read");
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it("getOpenInquiriesCount returns 0 and never reads the DB without a valid session", async () => {
    const { getOpenInquiriesCount } = await import("@/app/actions/inquiries.actions");

    await expect(getOpenInquiriesCount()).resolves.toBe(0);
    expect(mockCheckAppAuth).toHaveBeenCalledWith("read");
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it("createInquiry fails closed and never writes without a write role", async () => {
    const { createInquiry } = await import("@/app/actions/inquiries.actions");

    await expect(
      createInquiry({ customerName: "x", subject: "y", description: "z" }),
    ).resolves.toEqual({ success: false, error: "UNAUTHORIZED" });
    expect(mockCheckAppAuth).toHaveBeenCalledWith("write");
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("updateInquiry fails closed and never writes without a write role", async () => {
    const { updateInquiry } = await import("@/app/actions/inquiries.actions");

    await expect(updateInquiry("some-id", {})).resolves.toBeNull();
    expect(mockCheckAppAuth).toHaveBeenCalledWith("write");
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });
});
