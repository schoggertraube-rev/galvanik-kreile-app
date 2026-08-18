import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  floatingParkedCall: vi.fn(),
  getAuthorizationSnapshotAction: vi.fn(),
  parkedCallProvider: vi.fn(),
  pathname: { value: "/start" },
  realtimeSyncProvider: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => boundary.pathname.value,
}));
vi.mock("@/app/actions/auth.actions", () => ({
  getAuthorizationSnapshotAction: boundary.getAuthorizationSnapshotAction,
}));
vi.mock("@/components/layout/KreileHeader", () => ({
  KreileHeader: () => <div data-testid="header-marker" />,
}));
vi.mock("@/components/layout/RightNav", () => ({
  RightNav: () => <div data-testid="right-nav-marker" />,
}));
vi.mock("@/components/layout/MobileNav", () => ({
  MobileNav: () => <div data-testid="mobile-nav-marker" />,
}));
vi.mock("@/components/layout/MobileBottomNav", () => ({
  MobileBottomNav: () => <div data-testid="mobile-bottom-nav-marker" />,
}));
vi.mock("@/components/layout/SessionWarningBanner", () => ({
  SessionWarningBanner: ({ show }: { show: boolean }) => (
    <div data-show={String(show)} data-testid="session-warning-marker" />
  ),
}));
vi.mock("@/components/orders/OrderOverlay", () => ({
  OrderOverlay: () => <div data-testid="order-overlay-marker" />,
}));
vi.mock("@/components/customers/CustomerOverlay", () => ({
  CustomerOverlay: () => <div data-testid="customer-overlay-marker" />,
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
  boundary.getAuthorizationSnapshotAction.mockResolvedValue({ ok: true });
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
    expect(screen.getByTestId("order-overlay-marker")).toBeInTheDocument();
    expect(screen.getByTestId("customer-overlay-marker")).toBeInTheDocument();
    expect(screen.queryByTestId("header-marker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("right-nav-marker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mobile-nav-marker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mobile-bottom-nav-marker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("session-warning-marker")).not.toBeInTheDocument();
    expect(boundary.getAuthorizationSnapshotAction).not.toHaveBeenCalled();
    expectRemovedBrowserProvidersAbsent();
  });

  it("keeps the authenticated shell UI while removed browser providers stay inert", async () => {
    renderShell("/orders");

    expect(screen.getByTestId("children-marker")).toBeInTheDocument();
    expect(screen.getByTestId("header-marker")).toBeInTheDocument();
    expect(screen.getByTestId("right-nav-marker")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-nav-marker")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-bottom-nav-marker")).toBeInTheDocument();
    expect(screen.getByTestId("session-warning-marker")).toHaveAttribute("data-show", "false");
    expect(screen.getByTestId("order-overlay-marker")).toBeInTheDocument();
    expect(screen.getByTestId("customer-overlay-marker")).toBeInTheDocument();
    await waitFor(() => expect(boundary.getAuthorizationSnapshotAction).toHaveBeenCalledTimes(1));
    await act(async () => Promise.resolve());
    expectRemovedBrowserProvidersAbsent();
  });

  it("removes unsafe global provider and system-status identifiers while preserving both overlays in both branches", () => {
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

    expect(source.match(/<OrderOverlay\s*\/>/g)).toHaveLength(2);
    expect(source.match(/<CustomerOverlay\s*\/>/g)).toHaveLength(2);
  });

  it("keeps the touch-tablet navigation out of the desktop sidebar overlap", () => {
    const shellSource = readFileSync(
      resolve(process.cwd(), "src/components/layout/KreileAppShell.tsx"),
      "utf8",
    );
    const headerSource = readFileSync(
      resolve(process.cwd(), "src/components/layout/KreileHeader.tsx"),
      "utf8",
    );

    expect(shellSource).toContain('className="hidden xl:flex shrink-0 w-[72px] relative z-30"');
    expect(shellSource).not.toContain('className="hidden lg:flex shrink-0 w-[72px] relative z-30"');
    expect(headerSource).toContain('className="flex xl:hidden p-3');
    expect(headerSource).not.toContain('className="flex lg:hidden p-3');
  });
});
