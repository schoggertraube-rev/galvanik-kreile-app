import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileBottomNav } from "../MobileBottomNav";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
const permissionState = vi.hoisted(() => ({ canManageUsers: false }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => ({
    hasPermission: (key: string) =>
      key === "perm_sys_users" && permissionState.canManageUsers,
  }),
}));

describe("MobileBottomNav identity boundary", () => {
  beforeEach(() => {
    navigation.pathname = "/";
    permissionState.canManageUsers = false;
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("ignoriert eine alte Storage-Rolle und folgt nur dem aktuellen Berechtigungssnapshot", () => {
    localStorage.setItem("kreile_user_role", "admin");
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const { rerender } = render(<MobileBottomNav />);

    fireEvent.click(screen.getByRole("button", { name: "Mehr" }));
    expect(screen.queryByText("Verwaltung")).not.toBeInTheDocument();
    expect(getItem).not.toHaveBeenCalled();

    permissionState.canManageUsers = true;
    rerender(<MobileBottomNav />);
    expect(screen.getByText("Verwaltung")).toBeInTheDocument();

    permissionState.canManageUsers = false;
    rerender(<MobileBottomNav />);
    expect(screen.queryByText("Verwaltung")).not.toBeInTheDocument();
  });
});
