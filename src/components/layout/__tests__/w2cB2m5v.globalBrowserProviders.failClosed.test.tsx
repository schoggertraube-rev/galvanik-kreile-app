import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KreileAppShell } from "@/components/layout/KreileAppShell";

const boundary = vi.hoisted(() => ({
  pathname: "/start",
  auth: vi.fn(),
  role: "buero",
}));

vi.mock("next/navigation", () => ({ usePathname: () => boundary.pathname }));
vi.mock("@/app/actions/auth.actions", () => ({ getAuthorizationSnapshotAction: boundary.auth }));
vi.mock("@/lib/auth/PermissionsContext", () => ({ usePermissions: () => ({ role: boundary.role }) }));
vi.mock("@/components/layout/KreileHeader", () => ({ KreileHeader: () => <header data-testid="target-header" /> }));
vi.mock("@/components/layout/TargetNavigation", () => ({ TargetNavigation: () => <nav data-testid="target-navigation" /> }));
vi.mock("@/components/layout/MobileBottomNav", () => ({ MobileBottomNav: () => <nav data-testid="target-dock" /> }));
vi.mock("@/components/layout/SessionWarningBanner", () => ({ SessionWarningBanner: () => null }));
vi.mock("@/components/layout/EntityOverlayStack", () => ({ EntityOverlayStack: () => <div data-testid="entity-overlay-stack" /> }));

beforeEach(() => {
  vi.clearAllMocks();
  boundary.auth.mockResolvedValue({ ok: true });
  boundary.role = "buero";
});
afterEach(() => cleanup());

describe("target shell composition", () => {
  it("keeps /start strictly login-only", () => {
    boundary.pathname = "/start";
    render(<KreileAppShell><div>Login</div></KreileAppShell>);
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.queryByTestId("target-header")).not.toBeInTheDocument();
    expect(screen.queryByTestId("entity-overlay-stack")).not.toBeInTheDocument();
    expect(boundary.auth).not.toHaveBeenCalled();
  });

  it("composes Rolf shell, accepted navigation and shared cards for office roles", async () => {
    boundary.pathname = "/orders";
    render(<KreileAppShell><div>Orders</div></KreileAppShell>);
    expect(screen.getByTestId("target-header")).toBeInTheDocument();
    expect(screen.getByTestId("target-navigation")).toBeInTheDocument();
    expect(screen.getByTestId("target-dock")).toBeInTheDocument();
    expect(screen.getByTestId("entity-overlay-stack")).toBeInTheDocument();
    await waitFor(() => expect(boundary.auth).toHaveBeenCalledTimes(1));
  });

  it("uses the compact Phillip shell without the Rolf navigation", () => {
    boundary.pathname = "/";
    boundary.role = "werkstatt";
    render(<KreileAppShell><div>Werkstatt</div></KreileAppShell>);
    expect(screen.getByTestId("target-header")).toBeInTheDocument();
    expect(screen.queryByTestId("target-navigation")).not.toBeInTheDocument();
    expect(screen.queryByTestId("target-dock")).not.toBeInTheDocument();
  });
});
