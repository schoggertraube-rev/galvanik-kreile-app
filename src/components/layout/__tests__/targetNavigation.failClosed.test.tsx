import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { TargetNavigation } from "@/components/layout/TargetNavigation";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/auth/PermissionsContext", () => ({ usePermissions: () => ({ role: "buero" }) }));

afterEach(() => cleanup());

describe("target navigation availability", () => {
  it("links only to connected target areas and never into demo accounting or removed routes", () => {
    render(<><TargetNavigation /><MobileBottomNav /></>);
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/", "/warendurchlauf", "/orders", "/customers"]));
    for (const forbidden of ["/buchhaltung", "/kalender", "/betrieb", "/telefonnotiz", "/quotes"]) {
      expect(hrefs).not.toContain(forbidden);
    }
    expect(screen.queryByText(/Geld|Rechnungen/)).not.toBeInTheDocument();
  });
});
