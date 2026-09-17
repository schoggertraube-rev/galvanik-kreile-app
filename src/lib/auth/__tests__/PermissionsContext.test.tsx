process.env.DATABASE_URL = "postgres://mock:mock@localhost:5432/mock";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthorizationSnapshotAction } from "@/app/actions/auth.actions";
import type { AuthBootstrapState } from "@/lib/server/authBootstrap";
import {
  PermissionsProvider,
  deriveInitials,
  usePermissions,
} from "../PermissionsContext";
import {
  getPermissionsForRole,
  getProductIdentityByKey,
} from "../authorizationContract";

const navigation = vi.hoisted(() => ({
  pathname: "/orders",
  replace: vi.fn(),
}));

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

function TestComponent() {
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
}

const initialRolf: AuthBootstrapState = {
  status: "authenticated",
  user: { role: "meister", displayName: "Rolf" },
};

describe("identity labels and capabilities", () => {
  it("keeps browser-safe labels keyed separately from actor IDs", () => {
    expect(getProductIdentityByKey("rolf")).toEqual({
      name: "Rolf",
      responsibility: "Meister",
      initials: "R",
    });
    expect(getProductIdentityByKey("phillip").name).toBe("Phillip");
    expect(getProductIdentityByKey("gregor").name).toBe("Gregor");
  });

  it("keeps Meister capabilities broader than Werkstatt", () => {
    expect(getPermissionsForRole("meister")).toEqual(
      expect.arrayContaining(["perm_data_customers", "perm_data_orders"]),
    );
    expect(getPermissionsForRole("werkstatt")).not.toContain("perm_data_customers");
    expect(getPermissionsForRole("werkstatt")).not.toContain("perm_data_orders");
  });

  it("derives stable initials", () => {
    expect(deriveInitials("Rolf")).toBe("R");
    expect(deriveInitials("Phillip")).toBe("P");
    expect(deriveInitials("Gregor")).toBe("G");
    expect(deriveInitials("Unknown")).toBe("");
  });
});

describe("PermissionsProvider identity consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigation.pathname = "/orders";
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: true,
      data: {
        displayName: "Rolf",
        role: "meister",
        permissions: ["perm_view_leitstand"],
        active: true,
      },
    });
  });

  afterEach(() => cleanup());

  it("updates name, initials, role and permissions atomically after a session refresh", async () => {
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: true,
      data: {
        displayName: "Phillip",
        role: "werkstatt",
        permissions: ["perm_op_status"],
        active: true,
      },
    });

    render(
      <PermissionsProvider initialAuthState={initialRolf}>
        <TestComponent />
      </PermissionsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("name")).toHaveTextContent("Phillip");
      expect(screen.getByTestId("initials")).toHaveTextContent("P");
      expect(screen.getByTestId("role")).toHaveTextContent("werkstatt");
      expect(screen.getByTestId("permissions")).toHaveTextContent("perm_op_status");
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
  });

  it("clears stale identity when the server choke point fails closed", async () => {
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: false,
      status: "error",
      message: "Der Produktzugang ist momentan nicht sicher verfügbar.",
      supportReference: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    render(
      <PermissionsProvider initialAuthState={initialRolf}>
        <TestComponent />
      </PermissionsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("role")).toBeEmptyDOMElement();
      expect(screen.getByTestId("name")).toBeEmptyDOMElement();
      expect(screen.getByTestId("initials")).toBeEmptyDOMElement();
      expect(screen.getByTestId("permissions")).toBeEmptyDOMElement();
      expect(screen.getByTestId("status")).toHaveTextContent("error");
    });
    expect(screen.getByTestId("error")).not.toHaveTextContent("ACTOR_");
  });

  it("treats a missing session as signed out and returns to the login route", async () => {
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue({
      ok: false,
      status: "unauthenticated",
    });

    render(
      <PermissionsProvider initialAuthState={initialRolf}>
        <TestComponent />
      </PermissionsProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
      expect(screen.getByTestId("error")).toHaveTextContent("no-error");
      expect(navigation.replace).toHaveBeenCalledWith("/start");
    });
  });

  it("does not use local storage as a session or identity fallback", async () => {
    const getSpy = vi.spyOn(Storage.prototype, "getItem");
    const setSpy = vi.spyOn(Storage.prototype, "setItem");

    render(
      <PermissionsProvider initialAuthState={initialRolf}>
        <TestComponent />
      </PermissionsProvider>,
    );

    await waitFor(() => expect(getAuthorizationSnapshotAction).toHaveBeenCalledOnce());
    expect(getSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("does not re-read authorization merely because the route changes", async () => {
    const { rerender } = render(
      <PermissionsProvider initialAuthState={initialRolf}>
        <TestComponent />
      </PermissionsProvider>,
    );

    await waitFor(() => expect(getAuthorizationSnapshotAction).toHaveBeenCalledOnce());
    navigation.pathname = "/customers";
    rerender(
      <PermissionsProvider initialAuthState={initialRolf}>
        <TestComponent />
      </PermissionsProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(getAuthorizationSnapshotAction).toHaveBeenCalledOnce();
  });
});
