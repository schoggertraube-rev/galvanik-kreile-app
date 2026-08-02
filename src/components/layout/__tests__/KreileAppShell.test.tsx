import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KreileAppShell } from "../KreileAppShell";

const state = vi.hoisted(() => ({
  pathname: "/",
  status: "authenticated" as "authenticated" | "unauthenticated" | "error",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
}));

vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => ({ status: state.status }),
}));

vi.mock("@/app/actions/systemStats", () => ({
  getSystemStats: vi.fn().mockResolvedValue({ reachable: true, provider: "supabase" }),
}));

vi.mock("@/app/actions/auth.actions", () => ({
  getAuthorizationSnapshotAction: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../KreileHeader", () => ({
  KreileHeader: () => <div data-testid="kreile-header" />,
}));

vi.mock("../RightNav", () => ({ RightNav: () => <div /> }));
vi.mock("../MobileNav", () => ({ MobileNav: () => <div /> }));
vi.mock("../MobileBottomNav", () => ({ MobileBottomNav: () => <div /> }));
vi.mock("../PwaRegister", () => ({ PwaRegister: () => <div /> }));
vi.mock("../RealtimeSyncManager", () => ({
  RealtimeSyncProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/contexts/ParkedCallContext", () => ({
  ParkedCallProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/telefonnotiz/FloatingParkedCall", () => ({
  FloatingParkedCall: () => <div />,
}));
vi.mock("@/components/orders/OrderOverlay", () => ({ OrderOverlay: () => <div /> }));
vi.mock("@/components/customers/CustomerOverlay", () => ({ CustomerOverlay: () => <div /> }));
vi.mock("../SessionWarningBanner", () => ({
  SessionWarningBanner: ({ show }: { show: boolean }) =>
    show ? <div data-testid="session-warning" /> : null,
}));

describe("KreileAppShell identity boundary", () => {
  beforeEach(() => {
    state.pathname = "/";
    state.status = "authenticated";
    vi.clearAllMocks();
  });

  it("entfernt bei einer ungültigen Identität Seiteninhalt und Navigation fail-closed", () => {
    state.status = "unauthenticated";

    render(
      <KreileAppShell>
        <div data-testid="protected-content">Geschützter Inhalt</div>
      </KreileAppShell>,
    );

    expect(screen.getByTestId("session-warning")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("kreile-header")).not.toBeInTheDocument();
  });

  it("rendert den App-Inhalt nur mit einer aktuellen Identität", () => {
    render(
      <KreileAppShell>
        <div data-testid="protected-content">Geschützter Inhalt</div>
      </KreileAppShell>,
    );

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(screen.getByTestId("kreile-header")).toBeInTheDocument();
  });
});
