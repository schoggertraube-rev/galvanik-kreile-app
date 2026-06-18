import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAuthBootstrapState } from "../authBootstrap";
import * as appSessionModule from "../appSession";

describe("getAuthBootstrapState()", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. authentifizierter Bootstrap liefert dieselbe AppSession", async () => {
    const mockSession = {
      userId: "user-1",
      tenantId: "tenant-1",
      role: "admin",
      displayName: "Hans Meister",
      issuedAt: 1000,
      expiresAt: 2000,
    };

    vi.spyOn(appSessionModule, "readAppSession").mockResolvedValue({
      ok: true,
      session: mockSession,
    });

    const state = await getAuthBootstrapState();
    expect(state).toEqual({
      status: "authenticated",
      session: mockSession,
    });
  });

  it("2. fehlendes Cookie liefert unauthenticated", async () => {
    vi.spyOn(appSessionModule, "readAppSession").mockResolvedValue({
      ok: false,
      reason: "NO_COOKIE",
    });

    const state = await getAuthBootstrapState();
    expect(state).toEqual({
      status: "unauthenticated",
    });
  });

  it("3. ungültige Session liefert definierten Fehler-Zustand gemäß Vertrag", async () => {
    vi.spyOn(appSessionModule, "readAppSession").mockResolvedValue({
      ok: false,
      reason: "INVALID_SIGNATURE",
    });

    const state = await getAuthBootstrapState();
    expect(state).toEqual({
      status: "error",
      message: "Sitzungsfehler: INVALID_SIGNATURE",
    });
  });
});
