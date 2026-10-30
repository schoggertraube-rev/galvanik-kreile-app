import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  actionGrants: {
    confirmPayment: false,
    editOrderContent: false,
    createCustomer: false,
    createQuote: false,
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("../authorization", () => ({
  resolveAuthorization: ports.resolveAuthorization,
  getAuthorizationActionGrants: () => ports.actionGrants,
}));

import { getAuthBootstrapState } from "../authBootstrap";

const gregorAuthorization = {
  ok: true as const,
  data: {
    userId: "33333333-3333-4333-8333-333333333333",
    tenantId: "synthetic-tenant",
    displayName: "Gregor",
    role: "developer" as const,
    areas: ["logins", "wartung"] as const,
    permissions: ["perm_sys_diag", "perm_sys_users"] as const,
    active: true as const,
  },
};

describe("getAuthBootstrapState()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ports.resolveAuthorization.mockResolvedValue(gregorAuthorization);
  });

  it("keeps database identity stable without exposing internal IDs", async () => {
    const firstLoad = await getAuthBootstrapState();
    const reload = await getAuthBootstrapState();

    expect(firstLoad).toEqual({
      status: "authenticated",
      user: {
        role: "developer",
        displayName: "Gregor",
        areas: ["logins", "wartung"],
        permissions: ["perm_sys_diag", "perm_sys_users"],
        actions: ports.actionGrants,
      },
    });
    expect(reload).toEqual(firstLoad);
    expect(JSON.stringify(firstLoad)).not.toContain(gregorAuthorization.data.userId);
    expect(JSON.stringify(firstLoad)).not.toContain(gregorAuthorization.data.tenantId);
    expect(ports.resolveAuthorization).toHaveBeenCalledTimes(2);
  });

  it("delivers role, display name and capabilities from a single resolution", async () => {
    const state = await getAuthBootstrapState();

    expect(state.status).toBe("authenticated");
    if (state.status !== "authenticated") return;
    expect(state.user.areas).toEqual(gregorAuthorization.data.areas);
    expect(state.user.permissions).toEqual(gregorAuthorization.data.permissions);
    expect(state.user.actions).toEqual(ports.actionGrants);
    expect(ports.resolveAuthorization).toHaveBeenCalledOnce();
  });

  it("hands out a copy instead of the shared authorization permission list", async () => {
    const state = await getAuthBootstrapState();

    expect(state.status).toBe("authenticated");
    if (state.status !== "authenticated") return;
    expect(state.user.areas).not.toBe(gregorAuthorization.data.areas);
    expect(state.user.permissions).not.toBe(gregorAuthorization.data.permissions);
  });

  it("returns unauthenticated only for a missing session", async () => {
    ports.resolveAuthorization.mockResolvedValue({
      ok: false,
      reason: "NO_SESSION",
      message: "not signed in",
    });

    const state = await getAuthBootstrapState();
    expect(state).toEqual({ status: "unauthenticated" });
    expect(JSON.stringify(state)).not.toContain("perm_");
  });

  it("turns an invalid session into a safe, explicit error", async () => {
    ports.resolveAuthorization.mockResolvedValue({
      ok: false,
      reason: "INVALID_SESSION",
      message: "technical detail",
    });

    const state = await getAuthBootstrapState();
    expect(state).toEqual({
      status: "error",
      message: "Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.",
    });
    expect(JSON.stringify(state)).not.toContain("perm_");
  });

  it("fails closed without exposing infrastructure detail", async () => {
    ports.resolveAuthorization.mockResolvedValue({
      ok: false,
      reason: "AUTHORIZATION_UNAVAILABLE",
      message: "technical detail",
    });

    const state = await getAuthBootstrapState();
    expect(state).toEqual({
      status: "error",
      message: "Der Produktzugang ist momentan nicht sicher verfügbar.",
    });
    expect(JSON.stringify(state)).not.toContain("AUTHORIZATION_UNAVAILABLE");
    expect(JSON.stringify(state)).not.toContain("technical detail");
    expect(JSON.stringify(state)).not.toContain("perm_");
  });
});
