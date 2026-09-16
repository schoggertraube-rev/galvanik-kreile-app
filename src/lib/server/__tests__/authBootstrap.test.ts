import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { getAuthBootstrapState } from "../authBootstrap";
import * as appSessionModule from "../appSession";

describe("getAuthBootstrapState()", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("KREILE_ROLF_APP_USER_ID", "rolf-actor");
    vi.stubEnv("KREILE_PHILLIP_APP_USER_ID", "phillip-actor");
    vi.stubEnv("KREILE_GREGOR_APP_USER_ID", "gregor-actor");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("1. authentifizierter Bootstrap liefert dieselbe AppSession", async () => {
    const mockSession = {
      userId: "gregor-actor",
      tenantId: "tenant-1",
      role: "admin",
      displayName: "Technical Admin",
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
      session: { ...mockSession, displayName: "Gregor" },
    });
  });

  it("fails closed for missing or ambiguous actor mappings", async () => {
    vi.spyOn(appSessionModule, "readAppSession").mockResolvedValue({
      ok: true,
      session: {
        userId: "unmapped-actor",
        tenantId: "tenant-1",
        role: "admin",
        displayName: "Technical Admin",
        issuedAt: 1000,
        expiresAt: 2000,
      },
    });
    await expect(getAuthBootstrapState()).resolves.toEqual({
      status: "error",
      message: "Sitzungsfehler: Kein eindeutiges Produktprofil konfiguriert",
    });

    vi.stubEnv("KREILE_ROLF_APP_USER_ID", "duplicate-actor");
    vi.stubEnv("KREILE_PHILLIP_APP_USER_ID", "duplicate-actor");
    vi.mocked(appSessionModule.readAppSession).mockResolvedValue({
      ok: true,
      session: {
        userId: "duplicate-actor",
        tenantId: "tenant-1",
        role: "meister",
        displayName: "Fremde Person",
        issuedAt: 1000,
        expiresAt: 2000,
      },
    });
    await expect(getAuthBootstrapState()).resolves.toEqual({
      status: "error",
      message: "Sitzungsfehler: Kein eindeutiges Produktprofil konfiguriert",
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
