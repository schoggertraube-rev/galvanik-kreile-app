import { afterEach, describe, expect, it, vi } from "vitest";

const { mockResolveAuthorization } = vi.hoisted(() => ({
  mockResolveAuthorization: vi.fn(),
}));

vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: mockResolveAuthorization }));

describe("guardMockApi", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns 404 in production even for an authenticated user", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KREILE_MOCK_API", "true");
    mockResolveAuthorization.mockResolvedValue({ ok: true, data: {} });
    const { guardMockApi } = await import("@/lib/server/mockApiGuard");
    expect((await guardMockApi())?.status).toBe(404);
  });

  it("returns 404 when disabled and 401 when enabled without auth", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("KREILE_MOCK_API", "false");
    mockResolveAuthorization.mockResolvedValue({ ok: false });
    const { guardMockApi } = await import("@/lib/server/mockApiGuard");
    expect((await guardMockApi())?.status).toBe(404);
    vi.stubEnv("KREILE_MOCK_API", "true");
    expect((await guardMockApi())?.status).toBe(401);
  });

  it("allows only authenticated non-production explicit mock mode", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("KREILE_MOCK_API", "true");
    mockResolveAuthorization.mockResolvedValue({ ok: true, data: {} });
    const { guardMockApi } = await import("@/lib/server/mockApiGuard");
    await expect(guardMockApi()).resolves.toBeNull();
  });
});
