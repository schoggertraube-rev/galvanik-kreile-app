process.env.DATABASE_URL = "postgres://mock:mock@localhost:5432/mock";

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import React from "react";
import { PermissionsProvider, usePermissions, deriveInitials } from "../PermissionsContext";
import type { AuthBootstrapState } from "@/lib/server/authBootstrap";
import { getAuthorizationSnapshotAction } from "@/app/actions/auth.actions";
import type { AuthorizationResult } from "@/lib/server/authorization";

let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

// Mock Supabase client to avoid real network
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}));

// Mock Server Actions to avoid real requests
vi.mock("@/app/actions/auth.actions", () => ({
  getAuthorizationSnapshotAction: vi.fn(),
}));

// Snapshot-Session (signierter Cookie-Inhalt): { uid, role, tenant, initials, exp }
function makeAuthState(overrides?: Partial<{ role: string; initials: string }>): AuthBootstrapState {
  return {
    status: "authenticated",
    session: {
      uid: "1",
      role: overrides?.role ?? "buero",
      tenant: "galvanik-kreile",
      initials: overrides?.initials ?? "CD",
      exp: Date.now() + 60_000,
    },
  };
}

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

    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: true,
      data: {
        userId: "user-1",
        tenantId: "galvanik-kreile",
        displayName: "Hans Meister",
        role: "buero",
        permissions: ["perm_view_leitstand"],
        active: true,
      },
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

  it("T-01: Refresh aktualisiert Name/Initialen aus dem DB-Snapshot", async () => {
    const initialState = makeAuthState();

    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: true,
      data: {
        userId: "1",
        tenantId: "galvanik-kreile",
        role: "buero",
        displayName: "Anderer Benutzer",
        permissions: ["perm_view_leitstand"],
        active: true,
      },
    } as AuthorizationResult);

    await act(async () => {
      render(
        <PermissionsProvider initialAuthState={initialState}>
          <TestComponent />
        </PermissionsProvider>
      );
    });

    expect(screen.getByTestId("name").textContent).toBe("Anderer Benutzer");
    expect(screen.getByTestId("initials").textContent).toBe("AB");
    expect(screen.getByTestId("role").textContent).toBe("buero");
    expect(screen.getByTestId("status").textContent).toBe("authenticated");
  });

  it("T-02: Passende Rolle", async () => {
    const initialState = makeAuthState();

    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: true,
      data: {
        userId: "1",
        tenantId: "galvanik-kreile",
        role: "buero",
        displayName: "Christian Dieter",
        permissions: ["perm_view_leitstand"],
        active: true,
      },
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

  it("T-03: Rollenwiderspruch -> error, Identität verworfen", async () => {
    const initialState = makeAuthState();

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
    expect(screen.getByTestId("permissions").textContent).toBe("");
    expect(screen.getByTestId("status").textContent).toBe("error");
    expect(screen.getByTestId("error").textContent).toBe("AUTH_ERROR: Sitzung veraltet");
  });

  it("T-04: Permission-Fehler (Netzwerk)", async () => {
    const initialState = makeAuthState();

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

  it("T-05: Kein Local Storage für Rolle/Initialen/User", async () => {
    const spyGet = vi.spyOn(Storage.prototype, "getItem");
    const spySet = vi.spyOn(Storage.prototype, "setItem");

    const initialState = makeAuthState();

    await act(async () => {
      render(
        <PermissionsProvider initialAuthState={initialState}>
          <TestComponent />
        </PermissionsProvider>
      );
    });

    spyGet.mock.calls.forEach((call) => {
      expect(call[0]).not.toMatch(/role|initial|user/);
    });
    spySet.mock.calls.forEach((call) => {
      expect(call[0]).not.toMatch(/role|initial|user/);
    });
  });

  it("4. Snapshot-Seeding: Rolle und Initialen sofort ohne Flackern", () => {
    const initialState = makeAuthState({ role: "admin", initials: "PP" });

    // Synchroner Render (ohne act): der Refresh ist noch nicht aufgeloest.
    render(
      <PermissionsProvider initialAuthState={initialState}>
        <TestComponent />
      </PermissionsProvider>
    );

    // Rolle, Initialen und Status kommen synchron aus dem Session-Snapshot.
    expect(screen.getByTestId("status").textContent).toBe("authenticated");
    expect(screen.getByTestId("initials").textContent).toBe("PP");
    expect(screen.getByTestId("role").textContent).toBe("admin");
  });

  it("T-06: Pathname-Wechsel triggert refresh und aktualisiert Identität", async () => {
    mockPathname = "/start";
    const initialState = makeAuthState();

    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValueOnce({
      ok: true,
      data: {
        userId: "1",
        tenantId: "galvanik-kreile",
        role: "buero",
        displayName: "Christian Dieter",
        permissions: ["perm_view_leitstand"],
        active: true,
      },
    } as AuthorizationResult);

    let rerenderFn: RenderResult["rerender"];
    await act(async () => {
      const res = render(
        <PermissionsProvider initialAuthState={initialState}>
          <TestComponent />
        </PermissionsProvider>
      );
      rerenderFn = res.rerender;
    });

    expect(screen.getByTestId("name").textContent).toBe("Christian Dieter");

    mockPathname = "/settings";
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValueOnce({
      ok: true,
      data: {
        userId: "2",
        tenantId: "galvanik-kreile",
        role: "admin",
        displayName: "Max Admin",
        permissions: ["perm_sys_toggles"],
        active: true,
      },
    } as AuthorizationResult);

    await act(async () => {
      rerenderFn(
        <PermissionsProvider initialAuthState={initialState}>
          <TestComponent />
        </PermissionsProvider>
      );
    });

    expect(screen.getByTestId("name").textContent).toBe("Max Admin");
    expect(screen.getByTestId("initials").textContent).toBe("MA");
    expect(screen.getByTestId("role").textContent).toBe("admin");
  });

  it("T-07: Guest-Fall (NO_SESSION) bei Pathname-Wechsel verwirft Identität", async () => {
    mockPathname = "/start";
    const initialState = makeAuthState();

    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValueOnce({
      ok: true,
      data: {
        userId: "1",
        tenantId: "galvanik-kreile",
        role: "buero",
        displayName: "Christian Dieter",
        permissions: ["perm_view_leitstand"],
        active: true,
      },
    } as AuthorizationResult);

    let rerenderFn: RenderResult["rerender"];
    await act(async () => {
      const res = render(
        <PermissionsProvider initialAuthState={initialState}>
          <TestComponent />
        </PermissionsProvider>
      );
      rerenderFn = res.rerender;
    });

    expect(screen.getByTestId("name").textContent).toBe("Christian Dieter");

    mockPathname = "/login";
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValueOnce({
      ok: false,
      reason: "NO_SESSION",
      message: "AUTH_ERROR: Nicht angemeldet",
    });

    await act(async () => {
      rerenderFn(
        <PermissionsProvider initialAuthState={initialState}>
          <TestComponent />
        </PermissionsProvider>
      );
    });

    // Identität geleert, Status unauthenticated (kein Fehler bei NO_SESSION).
    expect(screen.getByTestId("name").textContent).toBe("");
    expect(screen.getByTestId("initials").textContent).toBe("");
    expect(screen.getByTestId("role").textContent).toBe("");
    expect(screen.getByTestId("status").textContent).toBe("unauthenticated");
  });
});
