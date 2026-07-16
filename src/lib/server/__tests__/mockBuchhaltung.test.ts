import { afterEach, describe, expect, it, vi } from "vitest";
import { buchhaltungDataSource, buchhaltungMockEnabled } from "@/lib/server/mockBuchhaltung";

describe("buchhaltungMockEnabled", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("stays disabled in production even when the flag is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KREILE_MOCK_BUCHHALTUNG", "true");
    expect(buchhaltungMockEnabled()).toBe(false);
    expect(buchhaltungDataSource()).toBe("database");
  });

  it("requires the explicit flag outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("KREILE_MOCK_BUCHHALTUNG", "false");
    expect(buchhaltungMockEnabled()).toBe(false);
    vi.stubEnv("KREILE_MOCK_BUCHHALTUNG", "true");
    expect(buchhaltungMockEnabled()).toBe(true);
    expect(buchhaltungDataSource()).toBe("mock");
  });
});
