import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  resolveProductActorAuthorization: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../productActorReadiness", () => ({
  resolveProductActorAuthorization: ports.resolveProductActorAuthorization,
}));

import { getAuthBootstrapState } from "../authBootstrap";

const gregorAuthorization = {
  ok: true as const,
  data: {
    authorization: {
      userId: "33333333-3333-4333-8333-333333333333",
      tenantId: "synthetic-tenant",
      displayName: "Gregor",
      role: "admin" as const,
      permissions: ["perm_sys_diag"] as const,
      active: true as const,
    },
    actor: {
      key: "gregor" as const,
      actorId: "33333333-3333-4333-8333-333333333333",
      tenantId: "synthetic-tenant",
      role: "admin" as const,
      identity: {
        name: "Gregor" as const,
        responsibility: "Systemadministrator" as const,
        initials: "G" as const,
      },
      login: "email" as const,
    },
  },
};

describe("getAuthBootstrapState()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ports.resolveProductActorAuthorization.mockResolvedValue(gregorAuthorization);
  });

  it("keeps actor identity stable across bootstrap and reload without exposing IDs", async () => {
    const firstLoad = await getAuthBootstrapState();
    const reload = await getAuthBootstrapState();

    expect(firstLoad).toEqual({
      status: "authenticated",
      user: { role: "admin", displayName: "Gregor" },
    });
    expect(reload).toEqual(firstLoad);
    expect(JSON.stringify(firstLoad)).not.toContain(gregorAuthorization.data.actor.actorId);
    expect(ports.resolveProductActorAuthorization).toHaveBeenCalledTimes(2);
  });

  it("returns unauthenticated only for a missing session", async () => {
    ports.resolveProductActorAuthorization.mockResolvedValue({
      ok: false,
      reason: "NO_SESSION",
      message: "not signed in",
    });

    await expect(getAuthBootstrapState()).resolves.toEqual({
      status: "unauthenticated",
    });
  });

  it("turns an invalid session into a safe, explicit error", async () => {
    ports.resolveProductActorAuthorization.mockResolvedValue({
      ok: false,
      reason: "INVALID_SESSION",
      message: "technical detail",
    });

    await expect(getAuthBootstrapState()).resolves.toEqual({
      status: "error",
      message: "Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.",
    });
  });

  it("fails closed with a support reference when readiness is unavailable", async () => {
    ports.resolveProductActorAuthorization.mockResolvedValue({
      ok: false,
      reason: "ACTOR_READINESS_UNAVAILABLE",
      message: "technical detail",
      supportReference: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    const state = await getAuthBootstrapState();
    expect(state).toEqual({
      status: "error",
      message: "Der Produktzugang ist momentan nicht sicher verfügbar.",
      supportReference: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(JSON.stringify(state)).not.toContain("ACTOR_READINESS_UNAVAILABLE");
    expect(JSON.stringify(state)).not.toContain("technical detail");
  });
});
