import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  readSettings: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: ports.resolveAuthorization,
}));
vi.mock("next/navigation", () => ({ redirect: ports.redirect }));
vi.mock("@/app/actions/settings.actions", () => ({ readSettingsAction: ports.readSettings }));

import { SettingsAppAdapter } from "../SettingsAppAdapter";

function authorizationFor(role: "meister" | "admin" | "developer" | "buero") {
  return {
    ok: true as const,
    data: {
      userId: `synthetic-${role}`,
      tenantId: "synthetic-tenant",
      displayName: role === "meister" ? "Rolf" : "Gregor",
      role,
      permissions: ["perm_sys_diag"],
      active: true as const,
    },
  };
}

describe("Gregor system administration composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ports.resolveAuthorization.mockResolvedValue(
      authorizationFor("admin"),
    );
    ports.readSettings.mockResolvedValue({ code:"OK", snapshot:{ company:{companyName:"Galvanik Kreile",street:"Testweg 1",zip:"12345",city:"Berlin",country:"Deutschland",taxId:"DE123456789",iban:"DE001234",bic:"TESTDEFF",bankName:"Testbank",paymentTermDays:14,logoUrl:"/logo.png"}, users:[], numberRanges:[] }, services:[] });
  });

  it("renders settings for an admin role", async () => {
    render(await SettingsAppAdapter());
    expect(screen.getByTestId("gregor-system-admin")).toHaveTextContent("Firmendaten, Leistungen und bestehende Zugänge");
    expect(screen.getByRole("button", { name:"Firmendaten" })).toBeInTheDocument();
  });

  it.each(["meister", "developer"] as const)("renders settings for the %s role", async (role) => {
    ports.resolveAuthorization.mockResolvedValue(authorizationFor(role));
    render(await SettingsAppAdapter());
    expect(screen.getByRole("button", { name: "Firmendaten" })).toBeInTheDocument();
  });

  it("shows new-user creation as planned and limits stage one to the three existing actors", async () => {
    render(await SettingsAppAdapter());
    fireEvent.click(screen.getByRole("button", { name: "Nutzer & Rollen" }));
    expect(screen.getByLabelText("Nutzer anlegen geplant")).toHaveTextContent("geplant");
    expect(screen.getByLabelText("Nutzer anlegen geplant")).toHaveTextContent("Rolf, Phillip und Gregor");
    expect(screen.queryByText(/In Klärung/)).not.toBeInTheDocument();
  });

  it("redirects only missing or invalid sessions to start", async () => {
    ports.resolveAuthorization.mockResolvedValue({
      ok: false,
      reason: "NO_SESSION",
      message: "not signed in",
    });
    await expect(SettingsAppAdapter()).rejects.toThrow("REDIRECT:/start");
  });

  it("redirects a valid role without settings access to the role-aware root", async () => {
    ports.resolveAuthorization.mockResolvedValue(authorizationFor("buero"));
    await expect(SettingsAppAdapter()).rejects.toThrow("REDIRECT:/");
  });

  it("renders a stable fail-closed state instead of bouncing on readiness failure", async () => {
    ports.resolveAuthorization.mockResolvedValue({
      ok: false,
      reason: "ACTOR_READINESS_UNAVAILABLE",
      message: "technical detail",
      supportReference: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    render(await SettingsAppAdapter());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Produktzugang momentan nicht verfügbar",
    );
    expect(screen.getByText(/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/)).toBeInTheDocument();
    expect(ports.redirect).not.toHaveBeenCalled();
  });
});
