import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KreileHeader } from "@/components/layout/KreileHeader";

const boundary = vi.hoisted(() => ({
  logout: vi.fn(),
  replace: vi.fn(),
  role: "buero",
}));

vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    <a href={href} {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: boundary.replace }) }));
vi.mock("@/app/actions/auth", () => ({ logout: boundary.logout }));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => ({
    initials: "BK",
    name: "Berta Kreile",
    role: boundary.role,
    status: "authenticated",
  }),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("target header truth", () => {
  it("shows the target identity without calendar/provider or dead search claims", () => {
    render(<KreileHeader />);
    expect(screen.getByRole("link", { name: "Kreile Startseite" })).toHaveAttribute("href", "/");
    expect(screen.getByText("Berta Kreile")).toBeInTheDocument();
    expect(screen.queryByText(/Kalender|Wetter|Echtzeit|NOT_AVAILABLE|Suche/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Einstellungen" })).not.toBeInTheDocument();
  });

  it("offers settings only to admin/developer and logs out to the dedicated login", async () => {
    boundary.role = "admin";
    boundary.logout.mockResolvedValue(undefined);
    render(<KreileHeader />);
    expect(screen.getByRole("link", { name: "Einstellungen" })).toHaveAttribute("href", "/settings");
    fireEvent.click(screen.getByRole("button", { name: "Abmelden" }));
    await waitFor(() => expect(boundary.logout).toHaveBeenCalledTimes(1));
    expect(boundary.replace).toHaveBeenCalledWith("/start");
  });
});
