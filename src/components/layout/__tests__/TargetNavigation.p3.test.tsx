import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileBottomNav } from "../MobileBottomNav";
import { TargetNavigation } from "../TargetNavigation";

const boundary = vi.hoisted(() => ({ pathname: "/", role: "meister" }));

vi.mock("next/navigation", () => ({
  usePathname: () => boundary.pathname,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => ({ role: boundary.role }),
}));

const retiredRoutes = [
  "/cockpit", "/kalender", "/analyse", "/kontrolle", "/today", "/kommunikation",
  "/performance", "/status", "/marketing", "/baeder", "/scan", "/buchhaltung",
];

function hrefs(container: HTMLElement) {
  return [...container.querySelectorAll("a")].map((link) => link.getAttribute("href"));
}

describe("P3 target navigation capabilities", () => {
  beforeEach(() => {
    boundary.pathname = "/";
    boundary.role = "meister";
  });
  afterEach(() => cleanup());

  it("offers Rolf only the real Accounting-minimal route and no retired target", () => {
    const { container } = render(<TargetNavigation />);
    expect(screen.getByRole("link", { name: "Geld & Rechnungen" })).toHaveAttribute("href", "/buchhaltung/rechnungen");
    expect(hrefs(container)).not.toContain("/buchhaltung");
    retiredRoutes.forEach((route) => expect(hrefs(container)).not.toContain(route));
  });

  it("keeps Gregor on real system settings without an accounting dead end", () => {
    boundary.role = "admin";
    const { container } = render(<TargetNavigation />);
    expect(screen.getByRole("link", { name: "Einstellungen" })).toHaveAttribute("href", "/settings");
    expect(screen.queryByRole("link", { name: "Geld & Rechnungen" })).not.toBeInTheDocument();
    expect(hrefs(container)).not.toContain("/buchhaltung/rechnungen");
  });

  it("applies the same capability boundary in the mobile dock", () => {
    render(<MobileBottomNav />);
    expect(screen.getByRole("link", { name: "Geld" })).toHaveAttribute("href", "/buchhaltung/rechnungen");

    cleanup();
    boundary.role = "admin";
    render(<MobileBottomNav />);
    expect(screen.queryByRole("link", { name: "Geld" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mehr" }));
    expect(screen.getByRole("link", { name: "Einstellungen" })).toHaveAttribute("href", "/settings");
  });
});
