process.env.DATABASE_URL = "postgres://mock:mock@localhost:5432/mock";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthorizationSnapshotAction } from "@/app/actions/auth.actions";
import type { AuthorizationResult } from "@/lib/server/authorization";
import type { AuthBootstrapState } from "@/lib/server/authBootstrap";
import { deriveInitials, PermissionsProvider, usePermissions } from "../PermissionsContext";

const navigation = vi.hoisted(() => ({ pathname: "/", replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}));

vi.mock("@/app/actions/auth.actions", () => ({
  getAuthorizationSnapshotAction: vi.fn(),
}));

const mkSnapshot: AuthorizationResult = {
  ok: true,
  data: {
    userId: "mk-1",
    tenantId: "galvanik-kreile",
    displayName: "Max Karl Kreile",
    role: "werkstatt",
    permissions: ["perm_op_status", "perm_op_photos"],
    active: true,
  },
};

const adminSnapshot: AuthorizationResult = {
  ok: true,
  data: {
    userId: "admin-1",
    tenantId: "galvanik-kreile",
    displayName: "Rolf Kreile",
    role: "admin",
    permissions: ["perm_sys_users", "perm_view_leitstand"],
    active: true,
  },
};

const mkBootstrap: AuthBootstrapState = {
  status: "authenticated",
  session: {
    userId: "mk-1",
    tenantId: "galvanik-kreile",
    role: "werkstatt",
    displayName: "Max Karl Kreile",
    issuedAt: 1,
    expiresAt: Date.now() + 60_000,
  },
};

function IdentityProbe() {
  const {
    userId,
    tenantId,
    active,
    status,
    initials,
    name,
    role,
    permissions,
    error,
    refreshPermissions,
  } = usePermissions();

  return (
    <div>
      <span data-testid="user-id">{userId}</span>
      <span data-testid="tenant-id">{tenantId}</span>
      <span data-testid="active">{String(active)}</span>
      <span data-testid="status">{status}</span>
      <span data-testid="initials">{initials}</span>
      <span data-testid="name">{name}</span>
      <span data-testid="role">{role}</span>
      <span data-testid="permissions">{permissions.join(",")}</span>
      <span data-testid="error">{error ?? "no-error"}</span>
      <button type="button" data-testid="refresh" onClick={() => void refreshPermissions()}>
        Refresh
      </button>
    </div>
  );
}

function Provider({ initialAuthState = mkBootstrap }: { initialAuthState?: AuthBootstrapState }) {
  return (
    <PermissionsProvider initialAuthState={initialAuthState}>
      <IdentityProbe />
    </PermissionsProvider>
  );
}

async function expectIdentity(snapshot: Extract<AuthorizationResult, { ok: true }>) {
  await waitFor(() => {
    expect(screen.getByTestId("user-id").textContent).toBe(snapshot.data.userId);
    expect(screen.getByTestId("tenant-id").textContent).toBe(snapshot.data.tenantId);
    expect(screen.getByTestId("active").textContent).toBe("true");
    expect(screen.getByTestId("name").textContent).toBe(snapshot.data.displayName);
    expect(screen.getByTestId("initials").textContent).toBe(deriveInitials(snapshot.data.displayName));
    expect(screen.getByTestId("role").textContent).toBe(snapshot.data.role);
    expect(screen.getByTestId("permissions").textContent).toBe(snapshot.data.permissions.join(","));
    expect(screen.getByTestId("status").textContent).toBe("authenticated");
    expect(screen.getByTestId("error").textContent).toBe("no-error");
  });
}

describe("deriveInitials()", () => {
  it("erzeugt stabile Initialen aus dem Anzeigenamen", () => {
    expect(deriveInitials("Hans Meister")).toBe("HM");
    expect(deriveInitials("Max Karl Kreile")).toBe("MK");
    expect(deriveInitials("Christian")).toBe("C");
    expect(deriveInitials("User")).toBe("");
    expect(deriveInitials("Unknown")).toBe("");
    expect(deriveInitials("")).toBe("");
  });
});

describe("PermissionsProvider identity snapshot", () => {
  beforeEach(() => {
    navigation.pathname = "/";
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue(mkSnapshot);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uebernimmt den serverseitigen Snapshot statt die beim Layout-Mount eingefrorene Identitaet", async () => {
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue(adminSnapshot);

    render(<Provider />);

    await expectIdentity(adminSnapshot as Extract<AuthorizationResult, { ok: true }>);
  });

  it("wechselt im selben Provider MK -> Admin -> MK ohne alte Rollen, Rechte oder Initialen", async () => {
    vi.mocked(getAuthorizationSnapshotAction)
      .mockResolvedValueOnce(mkSnapshot)
      .mockResolvedValueOnce(adminSnapshot)
      .mockResolvedValueOnce(mkSnapshot);

    render(<Provider />);
    await expectIdentity(mkSnapshot as Extract<AuthorizationResult, { ok: true }>);

    fireEvent.click(screen.getByTestId("refresh"));
    await expectIdentity(adminSnapshot as Extract<AuthorizationResult, { ok: true }>);

    fireEvent.click(screen.getByTestId("refresh"));
    await expectIdentity(mkSnapshot as Extract<AuthorizationResult, { ok: true }>);
  });

  it("leert bei einer ungueltigen Sitzung den kompletten Snapshot und nur alte Identity-Storage-Schluessel", async () => {
    vi.mocked(getAuthorizationSnapshotAction)
      .mockResolvedValueOnce(mkSnapshot)
      .mockResolvedValueOnce({
        ok: false,
        reason: "INVALID_SESSION",
        message: "AUTH_ERROR: Sitzung abgelaufen",
      });

    render(<Provider />);
    await expectIdentity(mkSnapshot as Extract<AuthorizationResult, { ok: true }>);

    localStorage.setItem("kreile_user_role", "werkstatt");
    localStorage.setItem("kreile_user_initials", "MK");
    localStorage.setItem("unrelated-preference", "kept");

    fireEvent.click(screen.getByTestId("refresh"));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("error");
      expect(screen.getByTestId("user-id").textContent).toBe("");
      expect(screen.getByTestId("tenant-id").textContent).toBe("");
      expect(screen.getByTestId("active").textContent).toBe("false");
      expect(screen.getByTestId("name").textContent).toBe("");
      expect(screen.getByTestId("initials").textContent).toBe("");
      expect(screen.getByTestId("role").textContent).toBe("");
      expect(screen.getByTestId("permissions").textContent).toBe("");
      expect(screen.getByTestId("error").textContent).toBe("AUTH_ERROR: Sitzung abgelaufen");
    });

    expect(localStorage.getItem("kreile_user_role")).toBeNull();
    expect(localStorage.getItem("kreile_user_initials")).toBeNull();
    expect(localStorage.getItem("unrelated-preference")).toBe("kept");
  });

  it("behandelt eine fehlende Sitzung als unauthenticated, nicht als Restidentitaet", async () => {
    vi.mocked(getAuthorizationSnapshotAction)
      .mockResolvedValueOnce(mkSnapshot)
      .mockResolvedValueOnce({
        ok: false,
        reason: "NO_SESSION",
        message: "AUTH_ERROR: Nicht angemeldet",
      });

    render(<Provider />);
    await expectIdentity(mkSnapshot as Extract<AuthorizationResult, { ok: true }>);

    fireEvent.click(screen.getByTestId("refresh"));

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("unauthenticated");
      expect(screen.getByTestId("error").textContent).toBe("no-error");
      expect(screen.getByTestId("role").textContent).toBe("");
      expect(screen.getByTestId("permissions").textContent).toBe("");
    });
  });

  it("verwirft eine spaete Antwort des vorherigen Benutzers", async () => {
    let resolveStaleSnapshot: ((value: AuthorizationResult) => void) | undefined;
    const staleSnapshot = new Promise<AuthorizationResult>((resolve) => {
      resolveStaleSnapshot = resolve;
    });

    vi.mocked(getAuthorizationSnapshotAction)
      .mockResolvedValueOnce(mkSnapshot)
      .mockReturnValueOnce(staleSnapshot)
      .mockResolvedValueOnce(adminSnapshot);

    render(<Provider />);
    await expectIdentity(mkSnapshot as Extract<AuthorizationResult, { ok: true }>);

    fireEvent.click(screen.getByTestId("refresh"));
    fireEvent.click(screen.getByTestId("refresh"));
    await expectIdentity(adminSnapshot as Extract<AuthorizationResult, { ok: true }>);

    await act(async () => {
      resolveStaleSnapshot?.(mkSnapshot);
      await staleSnapshot;
    });

    await expectIdentity(adminSnapshot as Extract<AuthorizationResult, { ok: true }>);
  });

  it("ignoriert eine verspätete Resolver-Antwort nach dem Unmount", async () => {
    let resolveSnapshot: ((value: AuthorizationResult) => void) | undefined;
    const pendingSnapshot = new Promise<AuthorizationResult>((resolve) => {
      resolveSnapshot = resolve;
    });
    vi.mocked(getAuthorizationSnapshotAction).mockReturnValueOnce(pendingSnapshot);

    const { unmount } = render(<Provider />);
    unmount();
    localStorage.setItem("kreile_user_role", "werkstatt");

    await act(async () => {
      resolveSnapshot?.(adminSnapshot);
      await pendingSnapshot;
    });

    expect(localStorage.getItem("kreile_user_role")).toBe("werkstatt");
  });

  it("leert die Identität beim Ablauf im geöffneten Tab ohne Navigation fail-closed", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-08-02T10:00:00.000Z").getTime();
    vi.setSystemTime(now);
    const expiringBootstrap: AuthBootstrapState = {
      status: "authenticated",
      session: {
        ...mkBootstrap.session,
        issuedAt: now - 1_000,
        expiresAt: now + 1_000,
      },
    };

    render(<Provider initialAuthState={expiringBootstrap} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("status").textContent).toBe("authenticated");
    localStorage.setItem("kreile_user_role", "werkstatt");
    localStorage.setItem("kreile_user_initials", "MK");

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByTestId("status").textContent).toBe("unauthenticated");
    expect(screen.getByTestId("user-id").textContent).toBe("");
    expect(screen.getByTestId("role").textContent).toBe("");
    expect(screen.getByTestId("permissions").textContent).toBe("");
    expect(screen.getByTestId("active").textContent).toBe("false");
    expect(localStorage.getItem("kreile_user_role")).toBeNull();
    expect(localStorage.getItem("kreile_user_initials")).toBeNull();
    expect(navigation.replace).toHaveBeenCalledWith("/start");
  });

  it("aktualisiert denselben erhaltenen Layout-Provider beim Start-Login-Wechsel", async () => {
    vi.mocked(getAuthorizationSnapshotAction)
      .mockResolvedValueOnce(mkSnapshot)
      .mockResolvedValueOnce({
        ok: false,
        reason: "NO_SESSION",
        message: "AUTH_ERROR: Nicht angemeldet",
      })
      .mockResolvedValueOnce(adminSnapshot);

    const { rerender } = render(<Provider />);
    await expectIdentity(mkSnapshot as Extract<AuthorizationResult, { ok: true }>);

    localStorage.setItem("kreile_user_role", "werkstatt");
    localStorage.setItem("kreile_user_initials", "MK");
    navigation.pathname = "/start";
    rerender(<Provider />);

    await waitFor(() => {
      expect(screen.getByTestId("status").textContent).toBe("unauthenticated");
      expect(screen.getByTestId("role").textContent).toBe("");
    });
    expect(localStorage.getItem("kreile_user_role")).toBeNull();
    expect(localStorage.getItem("kreile_user_initials")).toBeNull();

    navigation.pathname = "/";
    rerender(<Provider />);

    await expectIdentity(adminSnapshot as Extract<AuthorizationResult, { ok: true }>);
  });

  it("liest oder schreibt keine Identitaet in localStorage", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    render(<Provider />);
    await expectIdentity(mkSnapshot as Extract<AuthorizationResult, { ok: true }>);

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});
