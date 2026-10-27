import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  readSettings: vi.fn(),
  saveFeature: vi.fn(),
  changeOwnPin: vi.fn(),
  saveManagedUser: vi.fn(),
  createManagedUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: ports.resolveAuthorization,
}));
vi.mock("next/navigation", () => ({ redirect: ports.redirect }));
vi.mock("@/app/actions/settings.actions", () => ({
  readSettingsAction: ports.readSettings,
  saveSalesStageFeatureAction: ports.saveFeature,
  saveCatalogServiceAction: vi.fn(),
  saveCompanySettingsAction: vi.fn(),
  saveManagedUserAction: ports.saveManagedUser,
  createManagedUserAction: ports.createManagedUser,
  setManagedUserAreaAction: vi.fn(),
  changeOwnPinAction: ports.changeOwnPin,
}));
vi.mock("@/app/actions/orders.actions", () => ({ setExtraWorkHourlyRateAction: vi.fn() }));

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
    ports.changeOwnPin.mockResolvedValue({ code: "OK" });
    ports.saveManagedUser.mockResolvedValue({ code: "OK" });
    ports.createManagedUser.mockResolvedValue({
      code: "OK",
      user: { id: "33333333-3333-4333-8333-333333333333", email: null, fullName: "Nina Neu", shortCode: "NN", designation: "Werkstatt", role: "werkstatt", active: true, areas: ["auftraege", "eingang", "kunden"], fixedAreas: [], isCurrent: false },
    });
    ports.readSettings.mockResolvedValue({ code:"OK", snapshot:{ company:{companyName:"Galvanik Kreile",street:"Testweg 1",zip:"12345",city:"Berlin",country:"Deutschland",taxId:"DE123456789",iban:"DE001234",bic:"TESTDEFF",bankName:"Testbank",paymentTermDays:14,logoUrl:"/logo.png"}, extraWorkHourlyRate:{rateId:null,hourlyRateCents:null,version:0}, users:[], capabilities:{canManageCompany:true,canManageLogins:true,canManageSystem:true}, numberRanges:[], features:[{id:"S01",enabled:true},{id:"Z01",enabled:false}] }, services:[] });
  });

  it("renders settings for an admin role", async () => {
    render(await SettingsAppAdapter());
    expect(screen.getByTestId("gregor-system-admin")).toHaveTextContent("Firmendaten, Leistungen und bestehende Zugänge");
    expect(screen.getByRole("button", { name:"Firmendaten" })).toBeInTheDocument();
    expect(screen.getByLabelText("Stundensatz Mehrarbeit (€/h)")).toBeInTheDocument();
  });

  it.each(["meister", "developer"] as const)("renders settings for the %s role", async (role) => {
    ports.resolveAuthorization.mockResolvedValue(authorizationFor(role));
    render(await SettingsAppAdapter());
    expect(screen.getByRole("button", { name: "Firmendaten" })).toBeInTheDocument();
  });

  it("shows real new-user creation and the rights matrix", async () => {
    render(await SettingsAppAdapter());
    fireEvent.click(screen.getByRole("button", { name: "Logins & Rechte" }));
    expect(screen.getByRole("heading", { name: "Login anlegen" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Rechtematrix" })).toBeInTheDocument();
  });

  it("keeps Logins & Rechte open and adds a confirmed login to list and matrix", async () => {
    render(await SettingsAppAdapter());
    fireEvent.click(screen.getByRole("button", { name: "Logins & Rechte" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Nina Neu" } });
    fireEvent.change(screen.getByLabelText("Bezeichnung"), { target: { value: "Werkstatt" } });
    fireEvent.change(screen.getByLabelText("Code", { exact: true }), { target: { value: "2468" } });
    fireEvent.click(screen.getByRole("button", { name: "Login anlegen" }));

    expect(await screen.findByText("Nina Neu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logins & Rechte" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Aufträge & Werkstatt für Nina Neu")).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("Login angelegt.");
  });

  it("hides stage switches until they affect real product surfaces", async () => {
    render(await SettingsAppAdapter());
    expect(screen.queryByRole("button", { name: "Stufen-Schalter" })).not.toBeInTheDocument();
  });

  it("redirects only missing or invalid sessions to start", async () => {
    ports.resolveAuthorization.mockResolvedValue({
      ok: false,
      reason: "NO_SESSION",
      message: "not signed in",
    });
    await expect(SettingsAppAdapter()).rejects.toThrow("REDIRECT:/start");
  });

  it("lets every valid login change its own code", async () => {
    ports.resolveAuthorization.mockResolvedValue(authorizationFor("buero"));
    ports.readSettings.mockResolvedValue({ code:"OK", snapshot:{ company:{companyName:"",street:"",zip:"",city:"",country:"",taxId:"",iban:"",bic:"",bankName:"",paymentTermDays:0,logoUrl:""}, extraWorkHourlyRate:{rateId:null,hourlyRateCents:null,version:0}, users:[], capabilities:{canManageCompany:false,canManageLogins:false,canManageSystem:false}, numberRanges:[], features:[] }, services:[] });
    render(await SettingsAppAdapter());
    expect(screen.getByRole("heading", { name: "Mein Code ändern" })).toBeInTheDocument();
  });

  it("shows a stable error code when changing the own code cannot reach the server action", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    ports.changeOwnPin.mockRejectedValueOnce(new Error("Failed to find Server Action"));

    render(await SettingsAppAdapter());
    fireEvent.change(screen.getByLabelText("Neuer Code"), { target: { value: "4321" } });
    fireEvent.change(screen.getByLabelText("Code wiederholen"), { target: { value: "4321" } });
    fireEvent.click(screen.getByRole("button", { name: "Code speichern" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Fehlercode: ACTION_REQUEST_FAILED"));
    expect(consoleError).toHaveBeenCalledWith("[ACTION_REQUEST_FAILED]", expect.any(Error));
    consoleError.mockRestore();
  });

  it("shows the same error path when a managed user code cannot be saved", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    ports.saveManagedUser.mockRejectedValueOnce(new Error("Server Action request rejected"));
    ports.readSettings.mockResolvedValue({
      code: "OK",
      snapshot: {
        company: { companyName: "Galvanik Kreile", street: "Testweg 1", zip: "12345", city: "Berlin", country: "Deutschland", taxId: "DE123456789", iban: "DE001234", bic: "TESTDEFF", bankName: "Testbank", paymentTermDays: 14, logoUrl: "/logo.png" },
        extraWorkHourlyRate: { rateId: null, hourlyRateCents: null, version: 0 },
        users: [{ id: "11111111-1111-4111-8111-111111111111", email: null, fullName: "Phillip", shortCode: "PH", designation: "Werkstatt", role: "werkstatt", active: true, areas: ["werkstatt"], fixedAreas: [], isCurrent: false }],
        capabilities: { canManageCompany: true, canManageLogins: true, canManageSystem: true },
        numberRanges: [],
        features: [],
      },
      services: [],
    });

    render(await SettingsAppAdapter());
    fireEvent.click(screen.getByRole("button", { name: "Logins & Rechte" }));
    fireEvent.click(screen.getByRole("button", { name: "Ändern" }));
    fireEvent.change(screen.getAllByLabelText("Neuer Code")[1]!, { target: { value: "4321" } });
    fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Fehlercode: ACTION_REQUEST_FAILED"));
    expect(consoleError).toHaveBeenCalledWith("[ACTION_REQUEST_FAILED]", expect.any(Error));
    consoleError.mockRestore();
  });

  it("shows login data read-only and opens only one prefilled edit form", async () => {
    ports.readSettings.mockResolvedValue({
      code: "OK",
      snapshot: {
        company: { companyName: "Galvanik Kreile", street: "Testweg 1", zip: "12345", city: "Berlin", country: "Deutschland", taxId: "DE123456789", iban: "DE001234", bic: "TESTDEFF", bankName: "Testbank", paymentTermDays: 14, logoUrl: "/logo.png" },
        extraWorkHourlyRate: { rateId: null, hourlyRateCents: null, version: 0 },
        users: [
          { id: "11111111-1111-4111-8111-111111111111", email: null, fullName: "Phillip", shortCode: "PH", designation: "Werkstatt", role: "werkstatt", active: true, areas: ["werkstatt"], fixedAreas: [], isCurrent: false },
          { id: "22222222-2222-4222-8222-222222222222", email: null, fullName: "Rolf", shortCode: "RO", designation: "Meister", role: "meister", active: true, areas: ["werkstatt", "kunden"], fixedAreas: [], isCurrent: false },
        ],
        capabilities: { canManageCompany: true, canManageLogins: true, canManageSystem: true },
        numberRanges: [],
        features: [],
      },
      services: [],
    });

    render(await SettingsAppAdapter());
    fireEvent.click(screen.getByRole("button", { name: "Logins & Rechte" }));

    expect(screen.getAllByRole("button", { name: "Ändern" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Übernehmen" })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Ändern" })[0]!);
    const phillipRow = screen.getByText("Phillip").closest("article");
    expect(phillipRow).not.toBeNull();
    expect(within(phillipRow!).getByLabelText("Name")).toHaveValue("Phillip");
    expect(screen.getByRole("button", { name: "Übernehmen" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Ändern" })[1]!);
    const rolfRow = screen.getByText("Rolf").closest("article");
    expect(rolfRow).not.toBeNull();
    expect(within(rolfRow!).getByLabelText("Name")).toHaveValue("Rolf");
    expect(screen.getAllByRole("button", { name: "Übernehmen" })).toHaveLength(1);
    fireEvent.click(within(rolfRow!).getByRole("button", { name: "Abbrechen" }));
    expect(screen.queryByRole("button", { name: "Übernehmen" })).not.toBeInTheDocument();
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
    expect(screen.queryByText(/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/)).not.toBeInTheDocument();
    expect(ports.redirect).not.toHaveBeenCalled();
  });
});
