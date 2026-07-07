process.env.DATABASE_URL = "postgres://mock:mock@localhost:5432/mock";

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import { PermissionsProvider, usePermissions, deriveInitials } from "../PermissionsContext";
import type { AuthBootstrapState } from "@/lib/server/authBootstrap";
import { getAuthorizationSnapshotAction } from "@/app/actions/auth.actions";
import type { AuthorizationResult } from "@/lib/server/authorization";

// Mock Supabase client to avoid real network
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      })
    }
  })
}));

// Mock Server Actions to avoid real requests
vi.mock("@/app/actions/auth.actions", () => ({
  getAuthorizationSnapshotAction: vi.fn(),
}));

describe("deriveInitials()", () => {
  it("5. Initialen werden stabil aus displayName erzeugt", () => {
    expect(deriveInitials("Hans Meister")).toBe("HM");
    expect(deriveInitials("Max Karl Kreile")).toBe("MK");
    expect(deriveInitials("Christian")).toBe("C");
    expect(deriveInitials("User")).toBe("");
    expect(deriveInitials("Unknown")).toBe("");
    expect(deriveInitials("")).toBe("");
  });
});

describe("PermissionsProvider Bootstrap & central resolveAuthorization Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    // Default mock response for the single action call
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: true,
      data: {
        userId: "user-1",
        tenantId: "galvanik-kreile",
        displayName: "Hans Meister",
        role: "buero",
        permissions: ["perm_view_leitstand"],
        active: true,
      }
    } as AuthorizationResult);
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

  it("T-01: Sessionidentität bleibt stabil", async () => {
    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "t1",
        role: "buero",
        displayName: "Christian Dieter",
        issuedAt: 0,
        expiresAt: 0,
      }
    };

    // Client action returns different name, but context must NOT update name or initials
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: true,
      data: {
        userId: "1",
        tenantId: "t1",
        role: "buero",
        displayName: "Anderer Benutzer",
        permissions: ["perm_view_leitstand"],
        active: true,
      }
    } as AuthorizationResult);

    await act(async () => {
      render(
        <PermissionsProvider initialAuthState={initialState}>
          <TestComponent />
        </PermissionsProvider>
      );
    });

    // Now the context MUST update name and initials based on snapshot!
    expect(screen.getByTestId("name").textContent).toBe("Anderer Benutzer");
    expect(screen.getByTestId("initials").textContent).toBe("AB");
    expect(screen.getByTestId("role").textContent).toBe("buero");
    expect(screen.getByTestId("status").textContent).toBe("authenticated");
  });

  it("T-02: Passende Rolle", async () => {
    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "t1",
        role: "buero",
        displayName: "Christian Dieter",
        issuedAt: 0,
        expiresAt: 0,
      }
    };

    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: true,
      data: {
        userId: "1",
        tenantId: "t1",
        role: "buero",
        displayName: "Christian Dieter",
        permissions: ["perm_view_leitstand"],
        active: true,
      }
    } as AuthorizationResult);

    await act(async () => {
      render(
        <PermissionsProvider initialAuthState={initialState}>
          <TestComponent />
        </PermissionsProvider>
      );
    });

    expect(screen.getByTestId("status").textContent).toBe("authenticated");
    expect(screen.getByTestId("role").textContent).toBe("buero");
    expect(screen.getByTestId("permissions").textContent).toBe("perm_view_leitstand");
  });

  it("T-03: Rollenwiderspruch", async () => {
    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "t1",
        role: "buero",
        displayName: "Christian Dieter",
        issuedAt: 0,
        expiresAt: 0,
      }
    };

    // DB role differs (e.g. resolveAuthorization returns ROLE_MISMATCH error)
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: false,
      reason: "ROLE_MISMATCH",
      message: "AUTH_ERROR: Sitzung veraltet",
    });

    await act(async () => {
      render(
        <PermissionsProvider initialAuthState={initialState}>
          <TestComponent />
        </PermissionsProvider>
      );
    });

    expect(getAuthorizationSnapshotAction).toHaveBeenCalledTimes(1);

    expect(screen.getByTestId("role").textContent).toBe("");
    expect(screen.getByTestId("name").textContent).toBe("");
    expect(screen.getByTestId("initials").textContent).toBe("");
    expect(screen.getByTestId("permissions").textContent).toBe(""); // Discarded
    expect(screen.getByTestId("status").textContent).toBe("error");
    expect(screen.getByTestId("error").textContent).toBe("AUTH_ERROR: Sitzung veraltet");
  });

  it("T-04: Permission-Fehler", async () => {
    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "t1",
        role: "buero",
        displayName: "Christian Dieter",
        issuedAt: 0,
        expiresAt: 0,
      }
    };

    vi.mocked(getAuthorizationSnapshotAction).mockRejectedValue(new Error("Network Failure"));

    await act(async () => {
      render(
        <PermissionsProvider initialAuthState={initialState}>
          <TestComponent />
        </PermissionsProvider>
      );
    });

    expect(screen.getByTestId("role").textContent).toBe("");
    expect(screen.getByTestId("name").textContent).toBe("");
    expect(screen.getByTestId("initials").textContent).toBe("");
    expect(screen.getByTestId("status").textContent).toBe("error");
    expect(screen.getByTestId("error").textContent).toBe("AUTH_ERROR: Berechtigungen nicht verfügbar");
  });

  it("T-05: Kein Local Storage", async () => {
    const spyGet = vi.spyOn(Storage.prototype, "getItem");
    const spySet = vi.spyOn(Storage.prototype, "setItem");

    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "t1",
        role: "buero",
        displayName: "Christian Dieter",
        issuedAt: 0,
        expiresAt: 0,
      }
    };

    await act(async () => {
      render(
        <PermissionsProvider initialAuthState={initialState}>
          <TestComponent />
        </PermissionsProvider>
      );
    });

    spyGet.mock.calls.forEach(call => {
      expect(call[0]).not.toMatch(/role|initial|user/);
    });
    spySet.mock.calls.forEach(call => {
      expect(call[0]).not.toMatch(/role|initial|user/);
    });
  });

  it("4. Provider übernimmt initialAuthState ohne nachträgliches Local-Storage-Überschreiben", () => {
    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "t1",
        role: "admin",
        displayName: "Peter Pan",
        issuedAt: 0,
        expiresAt: 0,
      }
    };

    render(
      <PermissionsProvider initialAuthState={initialState}>
        <TestComponent />
      </PermissionsProvider>
    );

    expect(screen.getByTestId("status").textContent).toBe("authenticated");
    expect(screen.getByTestId("name").textContent).toBe("Peter Pan");
    expect(screen.getByTestId("initials").textContent).toBe("PP");
    expect(screen.getByTestId("role").textContent).toBe("admin");
  });
});
