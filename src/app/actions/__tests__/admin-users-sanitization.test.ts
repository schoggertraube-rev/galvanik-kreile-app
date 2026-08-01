import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAdminOrDeveloper = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();

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
  appUsers: {
    id: "id",
    tenantId: "tenant_id",
    email: "email",
    fullName: "full_name",
    role: "role",
    active: "active",
    location: "location",
    language: "language",
    pinHash: "pin_hash",
  },
  featureFlags: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
}));

describe("getUsers() payload sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminOrDeveloper.mockResolvedValue(undefined);
    mockFrom.mockReturnValue({ where: mockWhere });
  });

  it("omits pinHash and auth secrets from admin client DTOs", async () => {
    mockWhere.mockResolvedValue([
      {
        id: "user-1",
        email: "max@kreile.de",
        fullName: "Max Mustermann",
        role: "admin",
        active: true,
        location: null,
        language: "de",
        pinStatus: "needs_rotation",
        pinHash: "4321",
        authSecret: "service-role-secret",
      },
    ]);

    const { getUsers } = await import("@/app/actions/admin.actions");
    const result = await getUsers();
    const payload = JSON.stringify(result);

    expect(result).toEqual([
      {
        id: "user-1",
        email: "max@kreile.de",
        fullName: "Max Mustermann",
        role: "admin",
        active: true,
        location: null,
        language: "de",
        pinStatus: "needs_rotation",
      },
    ]);
    expect(payload).not.toContain("pinHash");
    expect(payload).not.toContain("4321");
    expect(payload).not.toContain("authSecret");
    expect(payload).not.toContain("service-role-secret");
  });
});
