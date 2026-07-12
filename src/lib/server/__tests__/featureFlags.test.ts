import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: mocks.select,
  },
}));

vi.mock("@/db/schema", () => ({
  featureFlags: {
    name: "name",
    enabled: "enabled",
  },
}));

describe("isServerFeatureEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.KREILE_CONTRACT_CUSTOMERS;
    mocks.select.mockReturnValue({ from: mocks.from });
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.where.mockReturnValue({ limit: mocks.limit });
    mocks.limit.mockResolvedValue([{ enabled: true }]);
  });

  it("uses env overrides first", async () => {
    process.env.KREILE_CONTRACT_CUSTOMERS = "true";
    const { isServerFeatureEnabled } = await import("../featureFlags");

    await expect(isServerFeatureEnabled("KREILE_CONTRACT_CUSTOMERS")).resolves.toBe(true);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("falls back to the feature_flags table when env is absent", async () => {
    const { isServerFeatureEnabled } = await import("../featureFlags");

    await expect(isServerFeatureEnabled("KREILE_CONTRACT_CUSTOMERS")).resolves.toBe(true);
    expect(mocks.select).toHaveBeenCalledTimes(1);
  });
});
