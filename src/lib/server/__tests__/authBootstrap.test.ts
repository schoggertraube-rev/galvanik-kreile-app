import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
}));

vi.mock("../authorization", () => ({
  resolveAuthorization: mocks.resolveAuthorization,
}));

describe("getAuthBootstrapState()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the resolved authorization snapshot for authenticated users", async () => {
    const mockSnapshot = {
      userId: "user-1",
      tenantId: "galvanik-kreile",
      displayName: "Max Kreile",
      initials: "MK",
      role: "admin" as const,
      permissions: ["perm_sys_diag"] as const,
      active: true as const,
    };

    mocks.resolveAuthorization.mockResolvedValue({
      ok: true,
      data: mockSnapshot,
    });

    const { getAuthBootstrapState } = await import("../authBootstrap");
    const state = await getAuthBootstrapState();

    expect(state).toEqual({
      status: "authenticated",
      session: mockSnapshot,
    });
  });

  it("maps NO_SESSION to unauthenticated", async () => {
    mocks.resolveAuthorization.mockResolvedValue({
      ok: false,
      reason: "NO_SESSION",
      message: "AUTH_ERROR: Nicht angemeldet",
    });

    const { getAuthBootstrapState } = await import("../authBootstrap");
    const state = await getAuthBootstrapState();

    expect(state).toEqual({
      status: "unauthenticated",
    });
  });

  it("keeps other authorization failures as error state", async () => {
    mocks.resolveAuthorization.mockResolvedValue({
      ok: false,
      reason: "INVALID_SESSION",
      message: "AUTH_ERROR: Ungueltige Sitzung",
    });

    const { getAuthBootstrapState } = await import("../authBootstrap");
    const state = await getAuthBootstrapState();

    expect(state).toEqual({
      status: "error",
      message: "AUTH_ERROR: Ungueltige Sitzung",
    });
  });
});
