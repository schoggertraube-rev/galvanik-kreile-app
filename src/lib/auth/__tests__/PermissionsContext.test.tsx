import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import { PermissionsProvider, usePermissions, deriveInitials } from "../PermissionsContext";
import type { AuthBootstrapState } from "@/lib/server/authBootstrap";
import { getRoleAction, getMyPermissionsAction } from "@/app/actions/auth.actions";

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
  getRoleAction: vi.fn(),
  getMyPermissionsAction: vi.fn(),
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

describe("PermissionsProvider Bootstrap & Refresh Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    // Default mock behavior
    vi.mocked(getRoleAction).mockResolvedValue("office");
    vi.mocked(getMyPermissionsAction).mockResolvedValue({
      permissions: ["test-perm"],
      name: "Hans Meister",
      initials: "HM",
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

  it("T-01: Sessionidentität bleibt stabil", async () => {
    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "t1",
        role: "office",
        displayName: "Christian Dieter",
        issuedAt: 0,
        expiresAt: 0,
      }
    };

    // Client action returns different name
    vi.mocked(getRoleAction).mockResolvedValue("office");
    vi.mocked(getMyPermissionsAction).mockResolvedValue({
      permissions: ["office-perm"],
      name: "Anderer Benutzer",
      initials: "AB",
    });

    await act(async () => {
      render(
        <PermissionsProvider initialAuthState={initialState}>
          <TestComponent />
        </PermissionsProvider>
      );
    });

    // Name and Initials must remain as initialized, not updated by refreshPermissions
    expect(screen.getByTestId("name").textContent).toBe("Christian Dieter");
    expect(screen.getByTestId("initials").textContent).toBe("CD");
    expect(screen.getByTestId("role").textContent).toBe("office");
    expect(screen.getByTestId("status").textContent).toBe("authenticated");
  });

  it("T-02: Passende Rolle", async () => {
    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "t1",
        role: "office",
        displayName: "Christian Dieter",
        issuedAt: 0,
        expiresAt: 0,
      }
    };

    vi.mocked(getRoleAction).mockResolvedValue("office");
    vi.mocked(getMyPermissionsAction).mockResolvedValue({
      permissions: ["office-perm"],
      name: "Christian Dieter",
      initials: "CD",
    });

    await act(async () => {
      render(
        <PermissionsProvider initialAuthState={initialState}>
          <TestComponent />
        </PermissionsProvider>
      );
    });

    expect(screen.getByTestId("status").textContent).toBe("authenticated");
    expect(screen.getByTestId("role").textContent).toBe("office");
    expect(screen.getByTestId("permissions").textContent).toBe("office-perm");
  });

  it("T-03: Rollenwiderspruch", async () => {
    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "t1",
        role: "office",
        displayName: "Christian Dieter",
        issuedAt: 0,
        expiresAt: 0,
      }
    };

    // Action returns admin instead of office
    vi.mocked(getRoleAction).mockResolvedValue("admin");
    vi.mocked(getMyPermissionsAction).mockResolvedValue({
      permissions: ["admin-perm"],
      name: "Christian Dieter",
      initials: "CD",
    });

    await act(async () => {
      render(
        <PermissionsProvider initialAuthState={initialState}>
          <TestComponent />
        </PermissionsProvider>
      );
    });

    expect(screen.getByTestId("role").textContent).toBe("office");
    expect(screen.getByTestId("name").textContent).toBe("Christian Dieter");
    expect(screen.getByTestId("initials").textContent).toBe("CD");
    expect(screen.getByTestId("permissions").textContent).toBe(""); // Not adopted
    expect(screen.getByTestId("status").textContent).toBe("error");
    expect(screen.getByTestId("error").textContent).toBe("AUTH_ERROR: Rollenwiderspruch");
  });

  it("T-04: Permission-Fehler", async () => {
    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "t1",
        role: "office",
        displayName: "Christian Dieter",
        issuedAt: 0,
        expiresAt: 0,
      }
    };

    vi.mocked(getRoleAction).mockRejectedValue(new Error("Network Failure"));

    await act(async () => {
      render(
        <PermissionsProvider initialAuthState={initialState}>
          <TestComponent />
        </PermissionsProvider>
      );
    });

    expect(screen.getByTestId("role").textContent).toBe("office");
    expect(screen.getByTestId("name").textContent).toBe("Christian Dieter");
    expect(screen.getByTestId("initials").textContent).toBe("CD");
    expect(screen.getByTestId("status").textContent).toBe("error");
    expect(screen.getByTestId("error").textContent).toBe("AUTH_ERROR: Abfrage fehlgeschlagen");
  });

  it("T-05: Kein Local Storage", async () => {
    const spyGet = vi.spyOn(Storage.prototype, "getItem");
    const spySet = vi.spyOn(Storage.prototype, "setItem");

    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "t1",
        role: "office",
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

    // Make sure we didn't call localStorage.getItem or setItem for user data
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
