import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { TargetNavigation } from "@/components/layout/TargetNavigation";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
const authorization = vi.hoisted(() => ({ role: "buero" }));
vi.mock("@/lib/auth/PermissionsContext", () => ({ usePermissions: () => ({ role: authorization.role }) }));

afterEach(() => cleanup());
beforeEach(() => { authorization.role = "buero"; });

describe("target navigation availability", () => {
  it.each(["buero", "meister", "admin"])("links invoice reader %s to the real minimal invoice route and never to demo accounting", (role) => {
    authorization.role = role;
    render(<><TargetNavigation /><MobileBottomNav /></>);
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/", "/warendurchlauf", "/orders", "/customers", "/buchhaltung/rechnungen"]));
    expect(screen.getByRole("link", { name: "Geld & Rechnungen" })).toHaveAttribute("href", "/buchhaltung/rechnungen");
    expect(screen.getByRole("link", { name: "Geld" })).toHaveAttribute("href", "/buchhaltung/rechnungen");
    expect(screen.getByRole("navigation", { name: "Mobile Hauptnavigation" })).toHaveAttribute("data-columns", "5");
    for (const forbidden of ["/buchhaltung", "/kalender", "/betrieb", "/telefonnotiz", "/quotes"]) {
      expect(hrefs).not.toContain(forbidden);
    }
  });

  it.each(["werkstatt", "readonly", "developer"])("keeps the invoice route absent for %s", (role) => {
    authorization.role = role;
    render(<><TargetNavigation /><MobileBottomNav /></>);
    expect(screen.queryByRole("link", { name: "Geld & Rechnungen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Geld" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Mobile Hauptnavigation" })).toHaveAttribute("data-columns", "4");
  });
});
