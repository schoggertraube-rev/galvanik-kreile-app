import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockAppFrame } from "@/components/layout/MockAppFrame";

const boundary = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: boundary.push }),
}));
vi.mock("@/components/layout/GlobalCreateFlow", () => ({ requestGlobalCreate: vi.fn() }));
vi.mock("@/components/layout/MoreMenu", () => ({ MoreMenu: () => null }));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => ({
    error: null,
    hasPermission: () => true,
    initials: "RK",
    loading: false,
    permissions: ["perm_view_leitstand", "perm_view_customers", "perm_view_prices"],
    role: "meister",
    status: "authenticated",
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1914 });
});

afterEach(() => cleanup());

describe("P0 Verkaufsstufe-1-Navigation", () => {
  it("zeigt die freigegebenen V8-Bereiche und sperrt geplante Anschlüsse", () => {
    render(<MockAppFrame><div>Inhalt</div></MockAppFrame>);

    ["Der Tag", "Werkstatt", "Aufträge", "Kunden & Kontakt", "Geld & Rechnungen", "Einstellungen"]
      .forEach((label) => expect(screen.getByRole("button", { name: label })).toBeEnabled());

    ["Zahlen", "Kalender", "Material & Einkauf"].forEach((label) => {
      const planned = screen.getByRole("button", { name: new RegExp(`^${label}\\s*geplant$`) });
      expect(planned).toBeDisabled();
      expect(planned).toHaveClass("nav", "planned");
      expect(planned).not.toHaveAttribute("data-href");
    });
  });
});
