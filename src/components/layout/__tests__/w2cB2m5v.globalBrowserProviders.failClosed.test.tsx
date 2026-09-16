import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  floatingParkedCall: vi.fn(),
  permissions: { loading: false, role: "buero", status: "authenticated" },
  parkedCallProvider: vi.fn(),
  pathname: { value: "/start" },
  realtimeSyncProvider: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => boundary.pathname.value,
}));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => boundary.permissions,
}));
vi.mock("@/components/layout/TargetHeader", () => ({
  TargetHeader: () => <div data-testid="target-header-marker" />,
}));
vi.mock("@/components/layout/TargetNavigation", () => ({
  TargetNavigation: () => <div data-testid="target-navigation-marker" />,
}));
vi.mock("@/components/layout/MobileBottomNav", () => ({
  MobileBottomNav: () => <div data-testid="mobile-bottom-nav-marker" />,
}));
vi.mock("@/components/layout/SessionWarningBanner", () => ({
  SessionWarningBanner: ({ show }: { show: boolean }) => (
    <div data-show={String(show)} data-testid="session-warning-marker" />
  ),
}));
vi.mock("@/components/layout/EntityOverlayStack", () => ({
  EntityOverlayStack: () => <div data-testid="entity-overlay-stack-marker" />,
}));
vi.mock("@/components/layout/RealtimeSyncManager", () => ({
  RealtimeSyncProvider: ({ children }: { children: React.ReactNode }) => {
    boundary.realtimeSyncProvider();
    return <div data-testid="realtime-sync-provider-marker">{children}</div>;
  },
}));
vi.mock("@/contexts/ParkedCallContext", () => ({
  ParkedCallProvider: ({ children }: { children: React.ReactNode }) => {
    boundary.parkedCallProvider();
    return <div data-testid="parked-call-provider-marker">{children}</div>;
  },
}));
vi.mock("@/components/telefonnotiz/FloatingParkedCall", () => ({
  FloatingParkedCall: () => {
    boundary.floatingParkedCall();
    return <div data-testid="floating-parked-call-marker" />;
  },
}));

import { KreileAppShell } from "@/components/layout/KreileAppShell";

function renderShell(pathname: string) {
  boundary.pathname.value = pathname;
  return render(
    <KreileAppShell>
      <div data-testid="children-marker" />
    </KreileAppShell>,
  );
}

function expectRemovedBrowserProvidersAbsent() {
  expect(boundary.realtimeSyncProvider).not.toHaveBeenCalled();
  expect(boundary.parkedCallProvider).not.toHaveBeenCalled();
  expect(boundary.floatingParkedCall).not.toHaveBeenCalled();
  expect(screen.queryByTestId("realtime-sync-provider-marker")).not.toBeInTheDocument();
  expect(screen.queryByTestId("parked-call-provider-marker")).not.toBeInTheDocument();
  expect(screen.queryByTestId("floating-parked-call-marker")).not.toBeInTheDocument();
}

beforeEach(() => {
  vi.clearAllMocks();
  boundary.permissions.loading = false;
  boundary.permissions.role = "buero";
  boundary.permissions.status = "authenticated";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("W2C-B2M5V global browser provider containment", () => {
  it.each(["/start", "/login"])("keeps %s minimal without global browser providers", (pathname) => {
    renderShell(pathname);

    expect(screen.getByTestId("children-marker")).toBeInTheDocument();
    expect(screen.queryByTestId("entity-overlay-stack-marker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("target-header-marker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("target-navigation-marker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mobile-bottom-nav-marker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("session-warning-marker")).not.toBeInTheDocument();
    expectRemovedBrowserProvidersAbsent();
  });

  it("keeps the authenticated shell UI while removed browser providers stay inert", () => {
    renderShell("/orders");

    expect(screen.getByTestId("children-marker")).toBeInTheDocument();
    expect(screen.getByTestId("target-header-marker")).toBeInTheDocument();
    expect(screen.getByTestId("target-navigation-marker")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-bottom-nav-marker")).toBeInTheDocument();
    expect(screen.getByTestId("session-warning-marker")).toHaveAttribute("data-show", "false");
    expect(screen.getByTestId("entity-overlay-stack-marker")).toBeInTheDocument();
    expectRemovedBrowserProvidersAbsent();
  });

  it("uses the single permission bootstrap truth for the session warning", () => {
    boundary.permissions.status = "error";
    renderShell("/orders");
    expect(screen.getByTestId("session-warning-marker")).toHaveAttribute("data-show", "true");
  });

  it("removes unsafe global providers and composes the single app-side entity stack", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/layout/KreileAppShell.tsx"),
      "utf8",
    );

    for (const removed of [
      "RealtimeSyncProvider",
      "ParkedCallProvider",
      "FloatingParkedCall",
      "./RealtimeSyncManager",
      "@/contexts/ParkedCallContext",
      "@/components/telefonnotiz/FloatingParkedCall",
      "getSystemStats",
      "isDemoMode",
      "Demo-/Offline Banner",
      "Supabase nicht erreichbar oder deaktiviert",
    ]) expect(source).not.toContain(removed);

    expect(source).toContain("<EntityOverlayStack />");
    expect(source).not.toMatch(/OrderOverlay|CustomerOverlay/);
  });

  it("keeps the touch-tablet navigation out of the desktop sidebar overlap", () => {
    const shellSource = readFileSync(
      resolve(process.cwd(), "src/components/layout/KreileAppShell.tsx"),
      "utf8",
    );
    expect(shellSource).toContain("<TargetNavigation />");
    expect(shellSource).toContain("<MobileBottomNav />");
    expect(shellSource).not.toContain("RightNav");
    expect(shellSource).not.toContain("MobileNav");
  });
});
