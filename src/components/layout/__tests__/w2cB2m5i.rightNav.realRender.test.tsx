import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RightNav } from "@/components/layout/RightNav";

const trackUiEvent = vi.hoisted(() => vi.fn(() => ({ ok: false as const, error: "NOT_AVAILABLE" as const, message: "NOT_AVAILABLE: UI-Tracking benötigt den W3-Command-Vertrag." as const })));

vi.mock("next/navigation", () => ({ usePathname: () => "/orders" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/auth/PermissionsContext", () => ({ usePermissions: () => ({ hasPermission: () => true, role: "admin" }) }));
vi.mock("@/lib/tracking/tracking", () => ({ trackUiEvent }));

describe("W2C-B2M5I RightNav real render", () => {
  let originalMatchMediaDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalMatchMediaDescriptor = Object.getOwnPropertyDescriptor(window, "matchMedia");
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    if (originalMatchMediaDescriptor) {
      Object.defineProperty(window, "matchMedia", originalMatchMediaDescriptor);
    } else {
      Reflect.deleteProperty(window, "matchMedia");
    }
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("keeps Home navigation and tracks the real expanded Auftraege sub-menu link", () => {
    render(<RightNav />);
    const home = screen.getByLabelText("Home");
    expect(home).toHaveAttribute("href", "/");
    expect(screen.getByLabelText("Warendurchlauf")).toHaveAttribute("href", "/warendurchlauf");
    fireEvent.click(home);
    expect(trackUiEvent).toHaveBeenCalledWith("nav_click", { target: "/" });
    expect(screen.getByLabelText("Home")).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("complementary"));
    const orders = screen.getByRole("link", { name: "Aufträge" });
    expect(orders).toHaveAttribute("href", "/orders");
    fireEvent.click(orders);
    expect(trackUiEvent).toHaveBeenCalledWith("nav_click", { target: "/orders", type: "sub_menu" });
  });
});
