import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResolveAuthorization = vi.fn();
const mockSelect = vi.fn();
const mockSeedDatabase = vi.fn();
const countResults: number[] = [];

vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: mockResolveAuthorization,
}));

vi.mock("@/db", () => ({
  db: {
    select: mockSelect,
  },
}));

vi.mock("@/db/schema", () => ({
  appUsers: "app_users",
  customers: "customers",
  orders: "orders",
}));

vi.mock("@/db/seed", () => ({
  seedDatabase: mockSeedDatabase,
}));

vi.mock("drizzle-orm", () => ({
  count: vi.fn(),
}));

describe("initializeDemoIfNeeded authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_DATA_PROVIDER", "supabase");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    vi.stubEnv("NODE_ENV", "development");
    countResults.length = 0;
    mockSelect.mockImplementation(() => ({
      from: vi.fn().mockImplementation(async () => [
        { value: countResults.shift() ?? 0 },
      ]),
    }));
  });

  it("is disabled in production before any database access", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { initializeDemoIfNeeded } = await import("@/app/actions/demoSetup");

    await expect(initializeDemoIfNeeded()).resolves.toEqual({
      initialized: false,
      reason: "disabled",
    });

    expect(mockResolveAuthorization).not.toHaveBeenCalled();
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockSeedDatabase).not.toHaveBeenCalled();
  });

  it("rejects anonymous demo initialization before reading or seeding data", async () => {
    mockResolveAuthorization.mockResolvedValue({
      ok: false,
      reason: "NO_SESSION",
      message: "AUTH_ERROR: Nicht angemeldet",
    });
    const { initializeDemoIfNeeded } = await import("@/app/actions/demoSetup");

    await expect(initializeDemoIfNeeded()).resolves.toEqual({
      initialized: false,
      reason: "unauthorized",
    });

    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockSeedDatabase).not.toHaveBeenCalled();
  });

  it("preserves authenticated demo initialization outside production", async () => {
    mockResolveAuthorization.mockResolvedValue({
      ok: true,
      data: {
        userId: "223e4567-e89b-42d3-a456-426614174001",
        tenantId: "galvanik-kreile",
        displayName: "Max Kreile",
        role: "admin",
        permissions: [],
        active: true,
      },
    });
    countResults.push(0, 0, 0);
    const { initializeDemoIfNeeded } = await import("@/app/actions/demoSetup");

    await expect(initializeDemoIfNeeded()).resolves.toEqual({ initialized: true });

    expect(mockResolveAuthorization).toHaveBeenCalledOnce();
    expect(mockSelect).toHaveBeenCalledTimes(3);
    expect(mockSeedDatabase).toHaveBeenCalledWith({ safeMode: true });
  });
});
