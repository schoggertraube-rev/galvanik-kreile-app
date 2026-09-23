import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  const identity = role === "werkstatt"
    ? { name: "Phillip", initials: "P" }
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
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/app/actions/auth", () => ({ logout: vi.fn(async () => {}) }));
vi.mock("@/components/layout/GlobalCreateFlow", () => ({ requestGlobalCreate: vi.fn() }));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => boundary.snapshot,
}));
vi.mock("../TargetHeader", () => ({
  MoreMenu: ({ open }: { open: boolean }) => open ? (
    <section role="dialog" aria-label="Mehr">
      <h2>Mehr</h2>
      <p>Seltene Funktionen eine Ebene tiefer.</p>
      <span>Infos rein</span><span>Werkstatt</span><span>Einstellungen</span><span>Abmelden</span>
    </section>
  ) : null,
}));

function expectBothClosed(snapshot: Partial<PermissionSnapshot>) {
  boundary.snapshot = snapshot;
  const desktop = render(<TargetNavigation />);
  expect(desktop.container.querySelector("nav")).not.toBeInTheDocument();
  cleanup();
  const mobile = render(<MobileBottomNav />);
  expect(mobile.container.querySelector("nav")).not.toBeInTheDocument();
}

describe("V5 target navigation contract", () => {
  beforeEach(() => {
    boundary.pathname = "/";
    boundary.snapshot = completeSnapshot("meister", ["perm_view_leitstand", "perm_view_customers"]);
  });
  afterEach(() => cleanup());

  it.each(["meister", "buero"])("shows the exact eight desktop and five mobile entries for %s", (role) => {
    boundary.snapshot = completeSnapshot(role, ["perm_view_leitstand", "perm_view_customers"]);
    render(<TargetNavigation />);
    const desktop = screen.getByRole("navigation", { name: "Hauptnavigation" });
    expect(within(desktop).getAllByRole("link").length + within(desktop).getAllByRole("button").length).toBe(8);
    for (const label of [
      "Neuer Eingang",
      "Ware raus",
      "Der Tag",
      "Werkstatt",
      "Aufträge",
      "Kunden & Kontakt",
      "Geld & Rechnungen",
      "Einstellungen",
    ]) expect(within(desktop).getByRole(label === "Neuer Eingang" ? "button" : "link", { name: label })).toBeVisible();

    cleanup();
    render(<MobileBottomNav />);
    const mobile = screen.getByRole("navigation", { name: "Mobile Hauptnavigation" });
    expect(within(mobile).getAllByRole("link")).toHaveLength(4);
    expect(within(mobile).getAllByRole("button")).toHaveLength(1);
    for (const label of ["Der Tag", "Aufträge", "Kunden", "Geld", "Mehr"])
      expect(within(mobile).getByRole(label === "Mehr" ? "button" : "link", { name: label })).toBeVisible();

    fireEvent.click(within(mobile).getByRole("button", { name: "Mehr" }));
    const more = screen.getByRole("dialog", { name: "Mehr" });
    expect(within(more).getByRole("heading", { name: "Mehr" })).toBeVisible();
    expect(within(more).getByText("Seltene Funktionen eine Ebene tiefer.")).toBeVisible();
    for (const label of ["Infos rein", "Werkstatt", "Einstellungen", "Abmelden"])
      expect(within(more).getByText(label)).toBeVisible();
  });

  it.each(["werkstatt", "readonly", "admin", "developer"])(
    "does not invent target navigation for the unsupported %s profile",
    (role) => expectBothClosed(completeSnapshot(role, ["perm_view_leitstand", "perm_view_customers", "perm_sys_diag"])),
  );

  it.each([
    ["role-only legacy snapshot", { role: "meister" }],
    ["loading snapshot", { ...completeSnapshot("meister", ["perm_view_leitstand", "perm_view_customers"]), loading: true }],
    ["auth error", { ...completeSnapshot("meister", ["perm_view_leitstand", "perm_view_customers"]), status: "error", error: "AUTH_ERROR" }],
    ["missing capability list", { ...completeSnapshot("meister", ["perm_view_leitstand", "perm_view_customers"]), permissions: undefined }],
    ["missing capability function", { ...completeSnapshot("meister", ["perm_view_leitstand", "perm_view_customers"]), hasPermission: undefined }],
    ["contradictory capability", { ...completeSnapshot("meister", ["perm_view_leitstand", "perm_view_customers"]), hasPermission: () => false }],
    ["missing customers capability", completeSnapshot("meister", ["perm_view_leitstand"])],
    ["missing leitstand capability", completeSnapshot("meister", ["perm_view_customers"])],
  ])("fails closed on desktop and mobile for %s", (_label, snapshot) => {
    expectBothClosed(snapshot as Partial<PermissionSnapshot>);
  });
});
