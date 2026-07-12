process.env.DATABASE_URL = "postgres://mock:mock@localhost:5432/mock";

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import { PermissionsProvider, usePermissions, deriveInitials } from "../PermissionsContext";
import type { AuthBootstrapState } from "@/lib/server/authBootstrap";
import { getAuthorizationSnapshotAction } from "@/app/actions/auth.actions";
import type { AuthorizationResult, AuthorizationSnapshot } from "@/lib/server/authorization";

const mocks = vi.hoisted(() => ({
  authStateSubscription: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: mocks.authStateSubscription,
    },
  }),
}));

vi.mock("@/app/actions/auth.actions", () => ({
  getAuthorizationSnapshotAction: vi.fn(),
}));

function makeAuthState(
  overrides?: Partial<{
    role: string;
    initials: string;
    displayName: string;
    permissions: readonly string[];
  }>
): AuthBootstrapState {
  const session: AuthorizationSnapshot = {
    userId: "1",
    tenantId: "galvanik-kreile",
    displayName: overrides?.displayName ?? "Clara Doe",
    role: (overrides?.role ?? "buero") as AuthorizationSnapshot["role"],
    permissions: (overrides?.permissions ?? ["perm_data_customers"]) as AuthorizationSnapshot["permissions"],
    active: true,
    initials: overrides?.initials ?? "CD",
  };

  return {
    status: "authenticated",
    session,
  };
}

describe("deriveInitials()", () => {
  it("builds stable initials from displayName", () => {
    expect(deriveInitials("Hans Meister")).toBe("HM");
    expect(deriveInitials("Max Karl Kreile")).toBe("MK");
    expect(deriveInitials("Christian")).toBe("C");
    expect(deriveInitials("User")).toBe("");
    expect(deriveInitials("Unknown")).toBe("");
    expect(deriveInitials("")).toBe("");
  });
});

describe("PermissionsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.authStateSubscription.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const TestComponent = () => {
    const { status, initials, name, role, permissions, error } = usePermissions();
    return (
      <div>
        <span data-testid="status">{status}</span>
        <span data-testid="initials">{initials}</span>
        <span data-testid="name">{name}</span>
        <span data-testid="role">{role}</span>
        <span data-testid="permissions">{permissions.join(",")}</span>
        <span data-testid="error">{error || "no-error"}</span>
      </div>
    );
  };

  it("seeds role, name, initials, and permissions immediately from bootstrap snapshot", () => {
    render(
      <PermissionsProvider initialAuthState={makeAuthState({ role: "admin", initials: "PP", displayName: "Paula Peters", permissions: ["perm_sys_users"] })}>
        <TestComponent />
      </PermissionsProvider>
    );

    expect(screen.getByTestId("status").textContent).toBe("authenticated");
    expect(screen.getByTestId("initials").textContent).toBe("PP");
    expect(screen.getByTestId("name").textContent).toBe("Paula Peters");
    expect(screen.getByTestId("role").textContent).toBe("admin");
    expect(screen.getByTestId("permissions").textContent).toContain("perm_sys_users");
    expect(getAuthorizationSnapshotAction).not.toHaveBeenCalled();
  });

  it("refresh updates the context from resolveAuthorization", async () => {
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: true,
      data: {
        userId: "1",
        tenantId: "galvanik-kreile",
        displayName: "Anderer Benutzer",
        initials: "AB",
        role: "buero",
        permissions: ["perm_view_leitstand"],
        active: true,
      },
    } as AuthorizationResult);

    let refreshPermissions: (() => Promise<void>) | null = null;
    const RefreshHarness = () => {
      refreshPermissions = usePermissions().refreshPermissions;
      return <TestComponent />;
    };

    render(
      <PermissionsProvider initialAuthState={makeAuthState()}>
        <RefreshHarness />
      </PermissionsProvider>
    );

    await act(async () => {
      await refreshPermissions?.();
    });

    expect(screen.getByTestId("name").textContent).toBe("Anderer Benutzer");
    expect(screen.getByTestId("initials").textContent).toBe("AB");
    expect(screen.getByTestId("role").textContent).toBe("buero");
    expect(screen.getByTestId("permissions").textContent).toBe("perm_view_leitstand");
  });

  it("refresh clears identity on NO_SESSION", async () => {
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: false,
      reason: "NO_SESSION",
      message: "AUTH_ERROR: Nicht angemeldet",
    });

    let refreshPermissions: (() => Promise<void>) | null = null;
    const RefreshHarness = () => {
      refreshPermissions = usePermissions().refreshPermissions;
      return <TestComponent />;
    };

    render(
      <PermissionsProvider initialAuthState={makeAuthState()}>
        <RefreshHarness />
      </PermissionsProvider>
    );

    await act(async () => {
      await refreshPermissions?.();
    });

    expect(screen.getByTestId("name").textContent).toBe("");
    expect(screen.getByTestId("initials").textContent).toBe("");
    expect(screen.getByTestId("role").textContent).toBe("");
    expect(screen.getByTestId("status").textContent).toBe("unauthenticated");
  });

  it("refresh switches to error state on resolver failure", async () => {
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: false,
      reason: "ROLE_MISMATCH",
      message: "AUTH_ERROR: Sitzung veraltet",
    });

    let refreshPermissions: (() => Promise<void>) | null = null;
    const RefreshHarness = () => {
      refreshPermissions = usePermissions().refreshPermissions;
      return <TestComponent />;
    };

    render(
      <PermissionsProvider initialAuthState={makeAuthState()}>
        <RefreshHarness />
      </PermissionsProvider>
    );

    await act(async () => {
      await refreshPermissions?.();
    });

    expect(screen.getByTestId("role").textContent).toBe("");
    expect(screen.getByTestId("name").textContent).toBe("");
    expect(screen.getByTestId("initials").textContent).toBe("");
    expect(screen.getByTestId("permissions").textContent).toBe("");
    expect(screen.getByTestId("status").textContent).toBe("error");
    expect(screen.getByTestId("error").textContent).toBe("AUTH_ERROR: Sitzung veraltet");
  });

  it("does not use localStorage for role or initials", () => {
    const spyGet = vi.spyOn(Storage.prototype, "getItem");
    const spySet = vi.spyOn(Storage.prototype, "setItem");

    render(
      <PermissionsProvider initialAuthState={makeAuthState()}>
        <TestComponent />
      </PermissionsProvider>
    );

    spyGet.mock.calls.forEach((call) => {
      expect(call[0]).not.toMatch(/role|initial|user/);
    });
    spySet.mock.calls.forEach((call) => {
      expect(call[0]).not.toMatch(/role|initial|user/);
    });
  });
});
