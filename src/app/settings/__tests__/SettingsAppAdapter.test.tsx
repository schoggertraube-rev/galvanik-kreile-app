import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  getProductIdentity: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: ports.resolveAuthorization }));
vi.mock("@/lib/auth/authorizationContract", () => ({ getProductIdentity: ports.getProductIdentity }));
vi.mock("next/navigation", () => ({ redirect: ports.redirect }));

import { SettingsAppAdapter } from "../SettingsAppAdapter";

const gregor = {
  ok: true as const,
  data: {
    userId: "33333333-3333-4333-8333-333333333333",
    tenantId: "tenant",
    displayName: "Gregor",
    role: "admin" as const,
    permissions: ["perm_sys_diag"] as const,
    active: true as const,
  },
};

describe("Gregor system administration composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ports.resolveAuthorization.mockResolvedValue(gregor);
    ports.getProductIdentity.mockReturnValue({ name: "Gregor", responsibility: "Systemadministrator", initials: "G" });
  });

  it("renders the real elevated actor and only real target routes", async () => {
    render(await SettingsAppAdapter());
    expect(screen.getByTestId("gregor-system-admin")).toHaveTextContent("Angemeldet als Gregor · Systemadministrator");
    expect(screen.getByText("Sitzung serverseitig bestätigt")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aufträge ansehen" })).toHaveAttribute("href", "/orders");
    expect(screen.getByRole("link", { name: "Kunden ansehen" })).toHaveAttribute("href", "/customers");
    expect(screen.queryByText(/NOT_AVAILABLE|Supabase verbunden|Demo-/i)).not.toBeInTheDocument();
  });

  it("fails closed for unauthenticated, unrelated and non-admin actors", async () => {
    ports.resolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "UNAUTHENTICATED" });
    await expect(SettingsAppAdapter()).rejects.toThrow("REDIRECT:/start");

    ports.getProductIdentity.mockReturnValueOnce(null);
    await expect(SettingsAppAdapter()).rejects.toThrow("REDIRECT:/");

    ports.resolveAuthorization.mockResolvedValueOnce({ ...gregor, data: { ...gregor.data, role: "meister" } });
    await expect(SettingsAppAdapter()).rejects.toThrow("REDIRECT:/");
  });
});
