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

describe("PermissionsProvider – atomarer Identity-Snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const TestComponent = () => {
    const { status, initials, name, role, permissions, error, refreshPermissions } = usePermissions();

    return (
      <div>
        <span data-testid="status">{status}</span>
        <span data-testid="initials">{initials}</span>
        <span data-testid="name">{name}</span>
        <span data-testid="role">{role}</span>
        <span data-testid="permissions">{permissions.join(",")}</span>
        <span data-testid="error">{error || "no-error"}</span>
        <button data-testid="refresh" onClick={() => void refreshPermissions()}>Refresh</button>
      </div>
    );
  };

  it("T-01: refreshPermissions aktualisiert Identität atomar bei Benutzerwechsel", async () => {
    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "galvanik-kreile",
        role: "werkstatt",
        displayName: "Christian Dieter",
        issuedAt: 0,
        expiresAt: Date.now() + 86400000,
      }
    };

    // Server liefert nach Benutzerwechsel andere Identität
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: true,
      data: {
        userId: "2",
        tenantId: "galvanik-kreile",
        role: "admin",
        displayName: "Rolf Kreile",
        permissions: ["perm_sys_users", "perm_view_leitstand"],
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

    // Alle Felder müssen die neue Identität widerspiegeln
    expect(screen.getByTestId("name").textContent).toBe("Rolf Kreile");
    expect(screen.getByTestId("initials").textContent).toBe("RK");
    expect(screen.getByTestId("role").textContent).toBe("admin");
    expect(screen.getByTestId("status").textContent).toBe("authenticated");
    expect(screen.getByTestId("permissions").textContent).toBe("perm_sys_users,perm_view_leitstand");
  });

  it("T-02: Passende Rolle und Identität bleiben stabil", async () => {
    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "galvanik-kreile",
        role: "buero",
        displayName: "Christian Dieter",
        issuedAt: 0,
        expiresAt: Date.now() + 86400000,
      }
    };

    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: true,
      data: {
        userId: "1",
        tenantId: "galvanik-kreile",
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
    expect(screen.getByTestId("name").textContent).toBe("Christian Dieter");
    expect(screen.getByTestId("initials").textContent).toBe("CD");
    expect(screen.getByTestId("permissions").textContent).toBe("perm_view_leitstand");
  });

  it("T-03: Ungültige Session leert alle Identitätsfelder vollständig", async () => {
    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "galvanik-kreile",
        role: "buero",
        displayName: "Christian Dieter",
        issuedAt: 0,
        expiresAt: Date.now() + 86400000,
      }
    };

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
    // Bei ungültiger Session: alles geleert
    expect(screen.getByTestId("role").textContent).toBe("");
    expect(screen.getByTestId("name").textContent).toBe("");
    expect(screen.getByTestId("initials").textContent).toBe("");
    expect(screen.getByTestId("permissions").textContent).toBe("");
    expect(screen.getByTestId("status").textContent).toBe("error");
    expect(screen.getByTestId("error").textContent).toBe("AUTH_ERROR: Sitzung veraltet");
  });

  it("T-04: Netzwerkfehler leert alle Identitätsfelder", async () => {
    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "galvanik-kreile",
        role: "buero",
        displayName: "Christian Dieter",
        issuedAt: 0,
        expiresAt: Date.now() + 86400000,
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

  it("T-05: Provider liest keine Identität aus localStorage", async () => {
    const spyGet = vi.spyOn(Storage.prototype, "getItem");
    const spySet = vi.spyOn(Storage.prototype, "setItem");

    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "galvanik-kreile",
        role: "buero",
        displayName: "Christian Dieter",
        issuedAt: 0,
        expiresAt: Date.now() + 86400000,
      }
    };

    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: true,
      data: {
        userId: "1",
        tenantId: "galvanik-kreile",
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

    spyGet.mock.calls.forEach(call => {
      expect(call[0]).not.toMatch(/role|initial|user/);
    });
    spySet.mock.calls.forEach(call => {
      expect(call[0]).not.toMatch(/role|initial|user/);
    });
  });

  it("T-06: MK → Logout → Admin → Logout → MK zeigt korrekte Identität", async () => {
    // Simuliert den kritischen Benutzerwechsel-Pfad
    const mkState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "mk-1",
        tenantId: "galvanik-kreile",
        role: "werkstatt",
        displayName: "Max Karl",
        issuedAt: 0,
        expiresAt: Date.now() + 86400000,
      }
    };

    // Phase 1: MK angemeldet
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: true,
      data: {
        userId: "mk-1",
        tenantId: "galvanik-kreile",
        role: "werkstatt",
        displayName: "Max Karl",
        permissions: ["perm_op_status", "perm_op_photos"],
        active: true,
      }
    } as AuthorizationResult);

    const { unmount } = await act(async () => {
      return render(
        <PermissionsProvider initialAuthState={mkState}>
          <TestComponent />
        </PermissionsProvider>
      );
    });

    expect(screen.getByTestId("name").textContent).toBe("Max Karl");
    expect(screen.getByTestId("initials").textContent).toBe("MK");
    expect(screen.getByTestId("role").textContent).toBe("werkstatt");

    unmount();

    // Phase 2: Admin angemeldet (neuer Mount nach Logout/Login)
    const adminState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "admin-1",
        tenantId: "galvanik-kreile",
        role: "admin",
        displayName: "Rolf Kreile",
        issuedAt: 0,
        expiresAt: Date.now() + 86400000,
      }
    };

    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: true,
      data: {
        userId: "admin-1",
        tenantId: "galvanik-kreile",
        role: "admin",
        displayName: "Rolf Kreile",
        permissions: ["perm_sys_users", "perm_view_leitstand", "perm_data_orders"],
        active: true,
      }
    } as AuthorizationResult);

    const { unmount: unmount2 } = await act(async () => {
      return render(
        <PermissionsProvider initialAuthState={adminState}>
          <TestComponent />
        </PermissionsProvider>
      );
    });

    expect(screen.getByTestId("name").textContent).toBe("Rolf Kreile");
    expect(screen.getByTestId("initials").textContent).toBe("RK");
    expect(screen.getByTestId("role").textContent).toBe("admin");

    unmount2();

    // Phase 3: MK wieder angemeldet – keine Reste von Admin
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: true,
      data: {
        userId: "mk-1",
        tenantId: "galvanik-kreile",
        role: "werkstatt",
        displayName: "Max Karl",
        permissions: ["perm_op_status", "perm_op_photos"],
        active: true,
      }
    } as AuthorizationResult);

    await act(async () => {
      render(
        <PermissionsProvider initialAuthState={mkState}>
          <TestComponent />
        </PermissionsProvider>
      );
    });

    expect(screen.getByTestId("name").textContent).toBe("Max Karl");
    expect(screen.getByTestId("initials").textContent).toBe("MK");
    expect(screen.getByTestId("role").textContent).toBe("werkstatt");
    expect(screen.getByTestId("permissions").textContent).toBe("perm_op_status,perm_op_photos");
  });

  it("4. Provider übernimmt initialAuthState korrekt", async () => {
    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "galvanik-kreile",
        role: "admin",
        displayName: "Peter Pan",
        issuedAt: 0,
        expiresAt: Date.now() + 86400000,
      }
    };

    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: true,
      data: {
        userId: "1",
        tenantId: "galvanik-kreile",
        role: "admin",
        displayName: "Peter Pan",
        permissions: ["perm_sys_users"],
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
    expect(screen.getByTestId("name").textContent).toBe("Peter Pan");
    expect(screen.getByTestId("initials").textContent).toBe("PP");
    expect(screen.getByTestId("role").textContent).toBe("admin");
  });

  it("T-07: Same-Provider-Roundtrip MK → Admin → unauthenticated → MK ohne Remount", async () => {
    // Beweist: derselbe laufende PermissionsProvider tauscht Identität atomar
    // bei wiederholtem refreshPermissions() ohne Restanzeige der vorigen Identität.
    // Kein StorageEvent als Trigger – direkt via refreshPermissions().
    const mkInitial: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "mk-1",
        tenantId: "galvanik-kreile",
        role: "werkstatt",
        displayName: "Max Karl",
        issuedAt: 0,
        expiresAt: Date.now() + 86400000,
      },
    };

    const mkSnapshot = {
      ok: true as const,
      data: {
        userId: "mk-1",
        tenantId: "galvanik-kreile",
        role: "werkstatt",
        displayName: "Max Karl",
        permissions: ["perm_op_status", "perm_op_photos"],
        active: true,
      },
    };

    const adminSnapshot = {
      ok: true as const,
      data: {
        userId: "admin-1",
        tenantId: "galvanik-kreile",
        role: "admin",
        displayName: "Rolf Kreile",
        permissions: ["perm_sys_users", "perm_view_leitstand", "perm_data_orders"],
        active: true,
      },
    };

    // Phase 1: MK initial
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue(
      mkSnapshot as AuthorizationResult
    );

    await act(async () => {
      render(
        <PermissionsProvider initialAuthState={mkInitial}>
          <TestComponent />
        </PermissionsProvider>
      );
    });

    expect(screen.getByTestId("name").textContent).toBe("Max Karl");
    expect(screen.getByTestId("initials").textContent).toBe("MK");
    expect(screen.getByTestId("role").textContent).toBe("werkstatt");
    expect(screen.getByTestId("permissions").textContent).toBe(
      "perm_op_status,perm_op_photos"
    );

    // Phase 2: Identitätswechsel zu Admin via refreshPermissions()
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue(
      adminSnapshot as AuthorizationResult
    );

    await act(async () => {
      screen.getByTestId("refresh").click();
    });

    expect(screen.getByTestId("name").textContent).toBe("Rolf Kreile");
    expect(screen.getByTestId("initials").textContent).toBe("RK");
    expect(screen.getByTestId("role").textContent).toBe("admin");
    expect(screen.getByTestId("permissions").textContent).toBe(
      "perm_sys_users,perm_view_leitstand,perm_data_orders"
    );

    // Phase 3: Logout – Server liefert ungültige Session, alle Felder müssen atomar geleert werden
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: false,
      reason: "ROLE_MISMATCH",
      message: "AUTH_ERROR: Sitzung beendet",
    });

    await act(async () => {
      screen.getByTestId("refresh").click();
    });

    expect(screen.getByTestId("name").textContent).toBe("");
    expect(screen.getByTestId("initials").textContent).toBe("");
    expect(screen.getByTestId("role").textContent).toBe("");
    expect(screen.getByTestId("permissions").textContent).toBe("");
    expect(screen.getByTestId("status").textContent).toBe("error");

    // Phase 4: Re-Login MK – kein Admin-Rest darf sichtbar werden
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue(
      mkSnapshot as AuthorizationResult
    );

    await act(async () => {
      screen.getByTestId("refresh").click();
    });

    expect(screen.getByTestId("name").textContent).toBe("Max Karl");
    expect(screen.getByTestId("initials").textContent).toBe("MK");
    expect(screen.getByTestId("role").textContent).toBe("werkstatt");
    expect(screen.getByTestId("permissions").textContent).toBe(
      "perm_op_status,perm_op_photos"
    );
    expect(screen.getByTestId("status").textContent).toBe("authenticated");
  });

});
