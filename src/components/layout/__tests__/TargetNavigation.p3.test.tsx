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

const boundary = vi.hoisted(() => ({
  pathname: "/",
  snapshot: {} as Partial<PermissionSnapshot>,
}));

function completeSnapshot(role: string, permissions: string[]): PermissionSnapshot {
  return {
    loading: false,
    status: "authenticated",
    error: null,
    role,
    permissions,
    name: role === "admin" ? "Gregor" : "Rolf",
    initials: role === "admin" ? "G" : "R",
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

  it("offers Rolf the released desktop targets only from the complete capability snapshot", () => {
    const { container } = render(<TargetNavigation />);
    expect(screen.getByRole("link", { name: "Der Tag" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Werkstatt" })).toHaveAttribute("href", "/warendurchlauf");
    expect(screen.getByRole("link", { name: "Aufträge" })).toHaveAttribute("href", "/orders");
    expect(screen.getByRole("link", { name: "Kunden & Kontakt" })).toHaveAttribute("href", "/customers");
    expect(screen.getByRole("link", { name: "Geld & Rechnungen" })).toHaveAttribute("href", "/buchhaltung/rechnungen");
    expect(hrefs(container)).not.toContain("/buchhaltung");
    retiredRoutes.forEach((route) => expect(hrefs(container)).not.toContain(route));
  });

  it("offers Rolf the released mobile targets only from the complete capability snapshot", () => {
    const { container } = render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Der Tag" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Aufträge" })).toHaveAttribute("href", "/orders");
    expect(screen.getByRole("link", { name: "Kunden" })).toHaveAttribute("href", "/customers");
    expect(screen.getByRole("link", { name: "Geld" })).toHaveAttribute("href", "/buchhaltung/rechnungen");
    fireEvent.click(screen.getByRole("button", { name: "Mehr" }));
    expect(screen.getByRole("link", { name: "Werkstatt" })).toHaveAttribute("href", "/warendurchlauf");
    retiredRoutes.forEach((route) => expect(hrefs(container)).not.toContain(route));
  });

  it("keeps each Meister target bound to its declared capability on desktop and mobile", () => {
    boundary.snapshot = completeSnapshot("meister", ["perm_view_leitstand"]);
    render(<TargetNavigation />);
    expect(screen.getByRole("link", { name: "Aufträge" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Kunden & Kontakt" })).not.toBeInTheDocument();

    cleanup();
    render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Aufträge" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Kunden" })).not.toBeInTheDocument();

    cleanup();
    boundary.snapshot = completeSnapshot("meister", ["perm_view_customers"]);
    render(<TargetNavigation />);
    expect(screen.queryByRole("link", { name: "Aufträge" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kunden & Kontakt" })).toBeInTheDocument();

    cleanup();
    render(<MobileBottomNav />);
    expect(screen.queryByRole("link", { name: "Aufträge" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kunden" })).toBeInTheDocument();
  });

  it("keeps Gregor on settings only when the complete snapshot grants perm_sys_diag", () => {
    boundary.snapshot = completeSnapshot("admin", ["perm_sys_diag"]);
    const { container } = render(<TargetNavigation />);
    expect(screen.getByRole("link", { name: "Einstellungen" })).toHaveAttribute("href", "/settings");
    expect(screen.queryByRole("link", { name: "Geld & Rechnungen" })).not.toBeInTheDocument();
    expect(hrefs(container)).toEqual(["/settings"]);

    cleanup();
    render(<MobileBottomNav />);
    expect(screen.queryByRole("link", { name: "Geld" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mehr" }));
    expect(screen.getByRole("link", { name: "Einstellungen" })).toHaveAttribute("href", "/settings");
  });

  it.each([
    ["role-only legacy snapshot", { role: "meister" }],
    ["loading snapshot", { ...completeSnapshot("meister", ["perm_view_leitstand"]), loading: true }],
    ["auth error", { ...completeSnapshot("meister", ["perm_view_leitstand"]), status: "error", error: "AUTH_ERROR" }],
    ["missing capability list", { ...completeSnapshot("meister", ["perm_view_leitstand"]), permissions: undefined }],
    ["missing capability function", { ...completeSnapshot("meister", ["perm_view_leitstand"]), hasPermission: undefined }],
    ["inconsistent capability function", { ...completeSnapshot("meister", []), hasPermission: () => true }],
    ["Meister without capabilities", completeSnapshot("meister", [])],
    ["Admin without perm_sys_diag", completeSnapshot("admin", [])],
  ])("fails closed on desktop and mobile for %s", (_label, snapshot) => {
    expectDesktopAndMobileClosed(snapshot as Partial<PermissionSnapshot>);
  });
});
