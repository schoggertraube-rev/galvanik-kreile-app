import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileBottomNav } from "../MobileBottomNav";
import { TargetNavigation } from "../TargetNavigation";

type PermissionSnapshot = {
  loading: boolean;
  status: "authenticated" | "unauthenticated" | "error";
  error: string | null;
  role: string | null;
  permissions: string[];
  name: string;
  initials: string;
  hasPermission: (permission: string) => boolean;
  refreshPermissions: () => Promise<void>;
};

type RoleNavigationCase = {
  role: string;
  permissions: string[];
  desktop: string[];
  mobile: string[];
  more: string[];
};

const boundary = vi.hoisted(() => ({
  pathname: "/",
  snapshot: {} as Partial<PermissionSnapshot>,
}));

function completeSnapshot(role: string, permissions: string[]): PermissionSnapshot {
  const identity = role === "werkstatt"
    ? { name: "Phillip", initials: "P" }
    : role === "admin" || role === "developer"
      ? { name: "Gregor", initials: "G" }
      : { name: "Rolf", initials: "R" };

  return {
    loading: false,
    status: "authenticated",
    error: null,
    role,
    permissions,
    ...identity,
    hasPermission: (permission) => permissions.includes(permission),
    refreshPermissions: vi.fn(async () => {}),
  };
}

vi.mock("next/navigation", () => ({
  usePathname: () => boundary.pathname,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => boundary.snapshot,
}));

const retiredRoutes = [
  "/cockpit", "/kalender", "/analyse", "/kontrolle", "/today", "/kommunikation",
  "/performance", "/status", "/marketing", "/baeder", "/scan", "/buchhaltung",
];
const CORE = ["/", "/warendurchlauf", "/orders", "/customers"];
const MOBILE_CORE = ["/", "/orders", "/customers"];
const roleNavigationCases: RoleNavigationCase[] = [
  {
    role: "meister",
    permissions: ["perm_view_leitstand", "perm_view_customers"],
    desktop: [...CORE, "/buchhaltung/rechnungen"],
    mobile: [...MOBILE_CORE, "/buchhaltung/rechnungen"],
    more: ["/warendurchlauf"],
  },
  {
    role: "buero",
    permissions: ["perm_view_leitstand", "perm_view_customers"],
    desktop: [...CORE, "/buchhaltung/rechnungen"],
    mobile: [...MOBILE_CORE, "/buchhaltung/rechnungen"],
    more: ["/warendurchlauf"],
  },
  {
    role: "readonly",
    permissions: ["perm_view_leitstand", "perm_view_customers"],
    desktop: CORE,
    mobile: MOBILE_CORE,
    more: ["/warendurchlauf"],
  },
  {
    role: "werkstatt",
    permissions: ["perm_view_leitstand", "perm_view_customers"],
    desktop: CORE,
    mobile: MOBILE_CORE,
    more: ["/warendurchlauf"],
  },
  {
    role: "admin",
    permissions: ["perm_sys_diag"],
    desktop: ["/settings"],
    mobile: [],
    more: ["/settings"],
  },
  {
    role: "developer",
    permissions: ["perm_sys_diag"],
    desktop: ["/settings"],
    mobile: [],
    more: ["/settings"],
  },
];

function hrefs(container: HTMLElement) {
  return [...container.querySelectorAll("a")].map((link) => link.getAttribute("href"));
}

function expectDesktopAndMobileClosed(snapshot: Partial<PermissionSnapshot>) {
  boundary.snapshot = snapshot;
  const desktop = render(<TargetNavigation />);
  expect(desktop.container.querySelector("nav")).not.toBeInTheDocument();

  cleanup();
  const mobile = render(<MobileBottomNav />);
  expect(mobile.container.querySelector("nav")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Mehr" })).not.toBeInTheDocument();
}

describe("P3 target navigation capabilities", () => {
  beforeEach(() => {
    boundary.pathname = "/";
    boundary.snapshot = completeSnapshot("meister", [
      "perm_view_leitstand",
      "perm_view_customers",
      "perm_data_orders",
    ]);
  });
  afterEach(() => cleanup());

  it.each(roleNavigationCases)(
    "keeps $role on the exact capability-bound desktop and mobile targets",
    ({ role, permissions, desktop: expectedDesktop, mobile: expectedMobile, more }) => {
      boundary.snapshot = completeSnapshot(role, permissions);
      const desktop = render(<TargetNavigation />);
      expect(hrefs(desktop.container)).toEqual(expectedDesktop);
      retiredRoutes.forEach((route) => expect(hrefs(desktop.container)).not.toContain(route));

      cleanup();
      const mobile = render(<MobileBottomNav />);
      expect(hrefs(mobile.container)).toEqual(expectedMobile);
      fireEvent.click(screen.getByRole("button", { name: "Mehr" }));
      expect(hrefs(mobile.container)).toEqual([...expectedMobile, ...more]);
      retiredRoutes.forEach((route) => expect(hrefs(mobile.container)).not.toContain(route));
    },
  );

  it("keeps each operational target bound to its declared capability on desktop and mobile", () => {
    boundary.snapshot = completeSnapshot("meister", ["perm_view_leitstand"]);
    const leitstandDesktop = render(<TargetNavigation />);
    expect(hrefs(leitstandDesktop.container)).toEqual([
      "/", "/warendurchlauf", "/orders", "/buchhaltung/rechnungen",
    ]);

    cleanup();
    const leitstandMobile = render(<MobileBottomNav />);
    expect(hrefs(leitstandMobile.container)).toEqual(["/", "/orders", "/buchhaltung/rechnungen"]);

    cleanup();
    boundary.snapshot = completeSnapshot("werkstatt", ["perm_view_customers"]);
    const customersDesktop = render(<TargetNavigation />);
    expect(hrefs(customersDesktop.container)).toEqual(["/customers"]);

    cleanup();
    const customersMobile = render(<MobileBottomNav />);
    expect(hrefs(customersMobile.container)).toEqual(["/customers"]);
  });

  it.each([
    ["role-only legacy snapshot", { role: "werkstatt" }],
    ["loading snapshot", { ...completeSnapshot("werkstatt", ["perm_view_leitstand"]), loading: true }],
    ["auth error", { ...completeSnapshot("werkstatt", ["perm_view_leitstand"]), status: "error", error: "AUTH_ERROR" }],
    ["missing capability list", { ...completeSnapshot("werkstatt", ["perm_view_leitstand"]), permissions: undefined }],
    ["missing capability function", { ...completeSnapshot("werkstatt", ["perm_view_leitstand"]), hasPermission: undefined }],
    ["capability absent from list", { ...completeSnapshot("werkstatt", []), hasPermission: () => true }],
    ["capability denied by function", { ...completeSnapshot("werkstatt", ["perm_view_leitstand"]), hasPermission: () => false }],
    ["Werkstatt without capabilities", completeSnapshot("werkstatt", [])],
    ["Meister without capabilities", completeSnapshot("meister", [])],
    ["Admin without perm_sys_diag", completeSnapshot("admin", [])],
  ])("fails closed on desktop and mobile for %s", (_label, snapshot) => {
    expectDesktopAndMobileClosed(snapshot as Partial<PermissionSnapshot>);
  });
});
