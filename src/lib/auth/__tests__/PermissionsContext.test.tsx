process.env.DATABASE_URL = "postgres://mock:mock@localhost:5432/mock";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAuthorizationSnapshotAction,
  type ClientAuthorizationResult,
} from "@/app/actions/auth.actions";
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
  const {
    status,
    initials,
    name,
    role,
    permissions,
    error,
    loading,
    refreshPermissions,
  } = usePermissions();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="initials">{initials}</span>
      <span data-testid="name">{name}</span>
      <span data-testid="role">{role}</span>
      <span data-testid="permissions">{permissions.join(",")}</span>
      <span data-testid="error">{error || "no-error"}</span>
      <span data-testid="loading">{loading ? "pending" : "ready"}</span>
      <button
        type="button"
        data-testid="refresh"
        onClick={() => {
          void refreshPermissions();
        }}
      >
        refresh
      </button>
    </div>
  );
}

/**
 * Settles an in-flight authorization request inside act and drains the
 * microtasks its catch/finally path needs. No fake timers involved: the
 * transient window can only close on a real task boundary, which this helper
 * deliberately never crosses.
 */
async function settleRefresh(trigger: () => void) {
  await act(async () => {
    trigger();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/**
 * Lets the transient "beforeunload" window close again, which is what happens
 * when the user aborts the announced navigation and stays on the page.
 */
async function expireTransientNavigationWindow() {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 1);
    });
  });
}

const authorizedRolf: ClientAuthorizationResult = {
  ok: true,
  data: {
    displayName: "Rolf",
    role: "meister",
    permissions: ["perm_view_leitstand"],
    active: true,
  },
};

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

  // "pagehide" is the permanent latch: the document is really gone, so the
  // request it cancelled must never surface as a product error.
  it("drops an in-flight refresh silently once the document is gone via pagehide", async () => {
    let rejectRefresh: ((error: Error) => void) | undefined;
    vi.mocked(getAuthorizationSnapshotAction).mockImplementation(
      () => new Promise((_, reject) => {
        rejectRefresh = reject;
      }),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <PermissionsProvider initialAuthState={initialRolf}>
        <TestComponent />
      </PermissionsProvider>,
    );

    await waitFor(() => expect(getAuthorizationSnapshotAction).toHaveBeenCalledOnce());
    fireEvent(window, new Event("pagehide"));
    await settleRefresh(() => rejectRefresh?.(new Error("document teardown cancelled the request")));

    // Stays silent: a request the teardown cancelled is not a product error.
    expect(consoleError).not.toHaveBeenCalled();
    // Does not fail open: no capability appears that the server never granted.
    expect(screen.getByTestId("permissions")).toBeEmptyDOMElement();
    // Keeps the established Rolf identity instead of a stale or error identity.
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("name")).toHaveTextContent("Rolf");
    expect(screen.getByTestId("initials")).toHaveTextContent("R");
    expect(screen.getByTestId("role")).toHaveTextContent("meister");
    expect(screen.getByTestId("error")).toHaveTextContent("no-error");
    consoleError.mockRestore();
  });

  // "beforeunload" only announces a navigation. The request it tears down
  // immediately stays silent, but loading must still be able to end, because
  // the page may survive an aborted navigation.
  it("stays silent and still ends loading when beforeunload tears the request down", async () => {
    let rejectRefresh: ((error: Error) => void) | undefined;
    vi.mocked(getAuthorizationSnapshotAction).mockImplementation(
      () => new Promise((_, reject) => {
        rejectRefresh = reject;
      }),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <PermissionsProvider initialAuthState={initialRolf}>
        <TestComponent />
      </PermissionsProvider>,
    );

    await waitFor(() => expect(getAuthorizationSnapshotAction).toHaveBeenCalledOnce());
    expect(screen.getByTestId("loading")).toHaveTextContent("pending");

    fireEvent(window, new Event("beforeunload"));
    await settleRefresh(() => rejectRefresh?.(new Error("navigation tore the request down")));

    expect(consoleError).not.toHaveBeenCalled();
    // The page is not latched inactive, so the UI leaves the loading state.
    expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    // Does not fail open: no capability appears that the server never granted.
    expect(screen.getByTestId("permissions")).toBeEmptyDOMElement();
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("name")).toHaveTextContent("Rolf");
    expect(screen.getByTestId("initials")).toHaveTextContent("R");
    expect(screen.getByTestId("role")).toHaveTextContent("meister");
    expect(screen.getByTestId("error")).toHaveTextContent("no-error");
    consoleError.mockRestore();
  });

  it("fails closed again once an aborted beforeunload window has expired", async () => {
    let rejectRefresh: ((error: Error) => void) | undefined;
    vi.mocked(getAuthorizationSnapshotAction)
      .mockResolvedValueOnce(authorizedRolf)
      .mockImplementation(
        () => new Promise((_, reject) => {
          rejectRefresh = reject;
        }),
      );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <PermissionsProvider initialAuthState={initialRolf}>
        <TestComponent />
      </PermissionsProvider>,
    );

    // Prove a real authorized start state instead of leaning on empty defaults.
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
      expect(screen.getByTestId("permissions")).toHaveTextContent("perm_view_leitstand");
      expect(screen.getByTestId("name")).toHaveTextContent("Rolf");
      expect(screen.getByTestId("role")).toHaveTextContent("meister");
      expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    });

    // A navigation is announced and immediately tears this request down.
    fireEvent.click(screen.getByTestId("refresh"));
    await waitFor(() => expect(getAuthorizationSnapshotAction).toHaveBeenCalledTimes(2));
    fireEvent(window, new Event("beforeunload"));
    await settleRefresh(() => rejectRefresh?.(new Error("navigation tore the request down")));

    expect(consoleError).not.toHaveBeenCalled();
    expect(screen.getByTestId("permissions")).toHaveTextContent("perm_view_leitstand");
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");

    // The user aborted the navigation: the transient window closes again.
    await expireTransientNavigationWindow();

    fireEvent.click(screen.getByTestId("refresh"));
    await waitFor(() => expect(getAuthorizationSnapshotAction).toHaveBeenCalledTimes(3));
    await settleRefresh(() => rejectRefresh?.(new Error("authorization backend unreachable")));

    // A genuine failure after the aborted navigation is visible and fails closed.
    expect(consoleError).toHaveBeenCalledWith("Failed to load permissions", expect.any(Error));
    expect(screen.getByTestId("status")).toHaveTextContent("error");
    expect(screen.getByTestId("role")).toBeEmptyDOMElement();
    expect(screen.getByTestId("name")).toBeEmptyDOMElement();
    expect(screen.getByTestId("initials")).toBeEmptyDOMElement();
    expect(screen.getByTestId("permissions")).toBeEmptyDOMElement();
    expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    consoleError.mockRestore();
  });

  it("fails closed on a real request rejection without any lifecycle signal", async () => {
    let rejectRefresh: ((error: Error) => void) | undefined;
    vi.mocked(getAuthorizationSnapshotAction)
      .mockResolvedValueOnce(authorizedRolf)
      .mockImplementation(
        () => new Promise((_, reject) => {
          rejectRefresh = reject;
        }),
      );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <PermissionsProvider initialAuthState={initialRolf}>
        <TestComponent />
      </PermissionsProvider>,
    );

    // Prove a real authorized start state instead of leaning on empty defaults.
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
      expect(screen.getByTestId("permissions")).toHaveTextContent("perm_view_leitstand");
      expect(screen.getByTestId("name")).toHaveTextContent("Rolf");
      expect(screen.getByTestId("role")).toHaveTextContent("meister");
      expect(screen.getByTestId("initials")).toHaveTextContent("R");
    });

    fireEvent.click(screen.getByTestId("refresh"));
    await waitFor(() => expect(getAuthorizationSnapshotAction).toHaveBeenCalledTimes(2));
    await settleRefresh(() => rejectRefresh?.(new Error("authorization backend unreachable")));

    expect(consoleError).toHaveBeenCalledWith("Failed to load permissions", expect.any(Error));
    expect(screen.getByTestId("status")).toHaveTextContent("error");
    expect(screen.getByTestId("role")).toBeEmptyDOMElement();
    expect(screen.getByTestId("name")).toBeEmptyDOMElement();
    expect(screen.getByTestId("initials")).toBeEmptyDOMElement();
    expect(screen.getByTestId("permissions")).toBeEmptyDOMElement();
    expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    consoleError.mockRestore();
  });
});
