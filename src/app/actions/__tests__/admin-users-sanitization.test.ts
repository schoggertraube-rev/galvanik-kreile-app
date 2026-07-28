import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAdminOrDeveloper = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/auth/permissions", () => ({
  requireAdminOrDeveloper: mockRequireAdminOrDeveloper,
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: mockFrom,
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  appUsers: {},
  featureFlags: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

describe("getUsers() foundation gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminOrDeveloper.mockResolvedValue(undefined);
  });

  it("fails closed before any admin-user read can occur", async () => {
    mockFrom.mockResolvedValue([
      {
        id: "user-1",
        email: "max@kreile.de",
        fullName: "Max Mustermann",
        role: "admin",
        active: true,
        location: null,
        language: "de",
        pinHash: "4321",
        authSecret: "service-role-secret",
      },
    ]);

    const { getUsers } = await import("@/app/actions/admin.actions");
    await expect(getUsers()).rejects.toThrow("NOT_CONFIGURED: Benutzer- und Rechteverwaltung");
    expect(mockRequireAdminOrDeveloper).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
