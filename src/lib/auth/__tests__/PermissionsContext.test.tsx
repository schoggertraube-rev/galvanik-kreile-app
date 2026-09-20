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

const supabaseAuth = vi.hoisted(() => ({
  handler: null as ((event: string) => void) | null,
  unsubscribe: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (handler: (event: string) => void) => {
        supabaseAuth.handler = handler;
        return {
          data: { subscription: { unsubscribe: supabaseAuth.unsubscribe } },
        };
      },
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
    hasPermission,
    refreshPermissions,
  } = usePermissions();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="initials">{initials}</span>
      <span data-testid="name">{name}</span>
      <span data-testid="role">{role}</span>
      <span data-testid="permissions">{permissions.join(",")}</span>
      <span data-testid="has-leitstand">
        {hasPermission("perm_view_leitstand") ? "granted" : "denied"}
      </span>
      <span data-testid="has-prices">
        {hasPermission("perm_view_prices") ? "granted" : "denied"}
      </span>
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
 * microtasks its catch/finally path needs.
 */
async function settleRefresh(trigger: () => void) {
  await act(async () => {
    trigger();
    await Promise.resolve();
    await Promise.resolve();
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

/**
 * The server bootstrap the RootLayout hands down: one resolution carrying
 * role, display name and the complete capability list.
 */
const initialRolf: AuthBootstrapState = {
  status: "authenticated",
  user: {
    role: "meister",
    displayName: "Rolf",
    permissions: getPermissionsForRole("meister"),
  },
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
    supabaseAuth.handler = null;
    vi.mocked(getAuthorizationSnapshotAction).mockResolvedValue(authorizedRolf);
  });

  afterEach(() => cleanup());

  // The core of this recovery: the provider is complete at mount, so it never
  // opens a server action POST on the current page that a full navigation
  // would tear down.
  it("seeds the complete authorization from the bootstrap without any mount request", async () => {
    render(
      <PermissionsProvider initialAuthState={initialRolf}>
        <TestComponent />
      </PermissionsProvider>,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("name")).toHaveTextContent("Rolf");
    expect(screen.getByTestId("initials")).toHaveTextContent("R");
    expect(screen.getByTestId("role")).toHaveTextContent("meister");
    expect(screen.getByTestId("permissions")).toHaveTextContent(
      getPermissionsForRole("meister").join(","),
    );
    expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    expect(screen.getByTestId("error")).toHaveTextContent("no-error");

    // Capabilities are usable immediately, and only the granted ones.
    expect(screen.getByTestId("has-leitstand")).toHaveTextContent("granted");
    expect(screen.getByTestId("has-prices")).toHaveTextContent("denied");

    // No mount-time server action, now or after React has settled.
    expect(getAuthorizationSnapshotAction).not.toHaveBeenCalled();
    await act(async () => {
      await Promise.resolve();
    });
    expect(getAuthorizationSnapshotAction).not.toHaveBeenCalled();
  });

  it("fails closed without capabilities when the bootstrap is unauthenticated", async () => {
    render(
      <PermissionsProvider initialAuthState={{ status: "unauthenticated" }}>
        <TestComponent />
      </PermissionsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
    expect(screen.getByTestId("permissions")).toBeEmptyDOMElement();
    expect(screen.getByTestId("role")).toBeEmptyDOMElement();
    expect(screen.getByTestId("name")).toBeEmptyDOMElement();
    expect(screen.getByTestId("has-leitstand")).toHaveTextContent("denied");
    expect(getAuthorizationSnapshotAction).not.toHaveBeenCalled();
    // A protected route is never reached without a session: src/proxy.ts
    // redirects server-side before this layout renders. The provider
    // therefore does not add a client-side mount redirect on top of it; the
    // redirect on a refresh result stays (see the signed-out case below).
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("fails closed without capabilities when the bootstrap reports an error", async () => {
    render(
      <PermissionsProvider
        initialAuthState={{
          status: "error",
          message: "Der Produktzugang ist momentan nicht sicher verfügbar.",
        }}
      >
        <TestComponent />
      </PermissionsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("status")).toHaveTextContent("error");
    expect(screen.getByTestId("permissions")).toBeEmptyDOMElement();
    expect(screen.getByTestId("role")).toBeEmptyDOMElement();
    expect(screen.getByTestId("has-leitstand")).toHaveTextContent("denied");
    expect(screen.getByTestId("error")).toHaveTextContent(
      "Der Produktzugang ist momentan nicht sicher verfügbar.",
    );
    expect(getAuthorizationSnapshotAction).not.toHaveBeenCalled();
  });

  it("updates name, initials, role and permissions atomically on an explicit refresh", async () => {
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

    fireEvent.click(screen.getByTestId("refresh"));

    await waitFor(() => {
      expect(screen.getByTestId("name")).toHaveTextContent("Phillip");
      expect(screen.getByTestId("initials")).toHaveTextContent("P");
      expect(screen.getByTestId("role")).toHaveTextContent("werkstatt");
      expect(screen.getByTestId("permissions")).toHaveTextContent("perm_op_status");
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    // No leftover of the previous identity's capabilities.
    expect(screen.getByTestId("has-leitstand")).toHaveTextContent("denied");
    expect(getAuthorizationSnapshotAction).toHaveBeenCalledOnce();
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

    fireEvent.click(screen.getByTestId("refresh"));

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

    fireEvent.click(screen.getByTestId("refresh"));

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
      expect(screen.getByTestId("permissions")).toBeEmptyDOMElement();
      expect(screen.getByTestId("error")).toHaveTextContent("no-error");
      expect(navigation.replace).toHaveBeenCalledWith("/start");
    });
  });

  // An auth state change is a real reason to re-read: the bootstrap that
  // seeded this document describes the previous session.
  it("re-reads authorization on SIGNED_IN and SIGNED_OUT, but not on other events", async () => {
    render(
      <PermissionsProvider initialAuthState={initialRolf}>
        <TestComponent />
      </PermissionsProvider>,
    );

    expect(supabaseAuth.handler).toBeTypeOf("function");
    expect(getAuthorizationSnapshotAction).not.toHaveBeenCalled();

    await act(async () => {
      supabaseAuth.handler?.("TOKEN_REFRESHED");
      await Promise.resolve();
    });
    expect(getAuthorizationSnapshotAction).not.toHaveBeenCalled();

    await act(async () => {
      supabaseAuth.handler?.("SIGNED_IN");
      await Promise.resolve();
    });
    expect(getAuthorizationSnapshotAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      supabaseAuth.handler?.("SIGNED_OUT");
      await Promise.resolve();
    });
    expect(getAuthorizationSnapshotAction).toHaveBeenCalledTimes(2);
  });

  it("does not use local storage as a session or identity fallback", async () => {
    const getSpy = vi.spyOn(Storage.prototype, "getItem");
    const setSpy = vi.spyOn(Storage.prototype, "setItem");

    render(
      <PermissionsProvider initialAuthState={initialRolf}>
        <TestComponent />
      </PermissionsProvider>,
    );

    fireEvent.click(screen.getByTestId("refresh"));
    await waitFor(() => expect(getAuthorizationSnapshotAction).toHaveBeenCalledOnce());
    expect(getSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
    getSpy.mockRestore();
    setSpy.mockRestore();
  });

  it("does not re-read authorization merely because the route changes", async () => {
    const { rerender } = render(
      <PermissionsProvider initialAuthState={initialRolf}>
        <TestComponent />
      </PermissionsProvider>,
    );

    navigation.pathname = "/customers";
    rerender(
      <PermissionsProvider initialAuthState={initialRolf}>
        <TestComponent />
      </PermissionsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(getAuthorizationSnapshotAction).not.toHaveBeenCalled();
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

    fireEvent.click(screen.getByTestId("refresh"));
    await waitFor(() => expect(getAuthorizationSnapshotAction).toHaveBeenCalledOnce());
    fireEvent(window, new Event("pagehide"));
    await settleRefresh(() => rejectRefresh?.(new Error("document teardown cancelled the request")));

    // Stays silent: a request the teardown cancelled is not a product error.
    expect(consoleError).not.toHaveBeenCalled();
    // Keeps the seeded Rolf identity instead of a stale or error identity.
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("name")).toHaveTextContent("Rolf");
    expect(screen.getByTestId("initials")).toHaveTextContent("R");
    expect(screen.getByTestId("role")).toHaveTextContent("meister");
    expect(screen.getByTestId("error")).toHaveTextContent("no-error");
    // Does not fail open: no capability appears beyond the seeded grant.
    expect(screen.getByTestId("has-prices")).toHaveTextContent("denied");
    consoleError.mockRestore();
  });

  it("fails closed on a real request rejection without any lifecycle signal", async () => {
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

    // Prove a real authorized start state instead of leaning on empty defaults.
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("permissions")).toHaveTextContent("perm_view_leitstand");

    fireEvent.click(screen.getByTestId("refresh"));
    await waitFor(() => expect(getAuthorizationSnapshotAction).toHaveBeenCalledOnce());
    await settleRefresh(() => rejectRefresh?.(new Error("authorization backend unreachable")));

    expect(consoleError).toHaveBeenCalledWith("Failed to load permissions", expect.any(Error));
    expect(screen.getByTestId("status")).toHaveTextContent("error");
    expect(screen.getByTestId("role")).toBeEmptyDOMElement();
    expect(screen.getByTestId("name")).toBeEmptyDOMElement();
    expect(screen.getByTestId("initials")).toBeEmptyDOMElement();
    expect(screen.getByTestId("permissions")).toBeEmptyDOMElement();
    expect(screen.getByTestId("has-leitstand")).toHaveTextContent("denied");
    expect(screen.getByTestId("loading")).toHaveTextContent("ready");
    consoleError.mockRestore();
  });

  // A bfcache restore replays a document whose seeded bootstrap may be stale.
  it("re-reads authorization when the document is restored from bfcache", async () => {
    render(
      <PermissionsProvider initialAuthState={initialRolf}>
        <TestComponent />
      </PermissionsProvider>,
    );

    fireEvent(window, new Event("pagehide"));
    const nonPersistedShow = new Event("pageshow") as Event & { persisted?: boolean };
    fireEvent(window, nonPersistedShow);
    await act(async () => {
      await Promise.resolve();
    });
    expect(getAuthorizationSnapshotAction).not.toHaveBeenCalled();

    const persistedShow = new Event("pageshow");
    Object.defineProperty(persistedShow, "persisted", { value: true });
    await act(async () => {
      fireEvent(window, persistedShow);
      await Promise.resolve();
    });
    expect(getAuthorizationSnapshotAction).toHaveBeenCalledOnce();
  });
});
