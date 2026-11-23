// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { SystemSettingsSnapshot } from "@/modules/fundament/public";
import { SETTINGS_PENDING_CONSUMER_COPY, UMSATZSTEUER_EINSTELLUNG_COPY } from "@/ui/situationCatalog";

vi.mock("@/app/settings/ShippingSettingsEditor", () => ({ ShippingSettingsEditor: () => null }));
vi.mock("@/app/settings/EmailTemplatesEditor", () => ({ EmailTemplatesEditor: () => null }));
vi.mock("@/app/actions/settings.actions", () => ({
  changeOwnPinAction: vi.fn(), createManagedUserAction: vi.fn(), saveCatalogServiceAction: vi.fn(),
  saveCompanySettingsAction: vi.fn(), saveManagedUserAction: vi.fn(), setManagedUserAreaAction: vi.fn(),
}));
vi.mock("@/app/actions/orders.actions", () => ({ setExtraWorkHourlyRateAction: vi.fn() }));

afterEach(() => cleanup());

it("R43 keeps synthetic settings without a live consumer out of the visible editor", async () => {
  const { SettingsAdminClient } = await import("@/app/settings/SettingsAdminClient");
  const snapshot = {
    company: {
      companyName: "TEST Firma", street: "TEST Straße", zip: "12345", city: "TEST Ort",
      country: "DE", taxId: "", iban: "", bic: "", bankName: "",
      paymentTermDays: 14, logoUrl: "", akzentfarbe: "#13714f",
      ausschussBerechnen: true, betriebsruhe: [],
      empfaenger: { steuerberater: "test@example.invalid", bank: null },
      betriebswaechter: { sicherungsort: "TEST" },
      mehrarbeit: { spielraumBasispunkte: 1000 },
      umsatzsteuer: { regelsatzBasispunkte: 1900, ermaessigtBasispunkte: 700 },
    },
    extraWorkHourlyRate: { rateId: null, hourlyRateCents: null, version: 0 },
    users: [], capabilities: { canManageCompany: true, canManageLogins: false,
      canManageFinancial: true, canManageSystem: false },
    numberRanges: [], features: [],
  } as unknown as SystemSettingsSnapshot;
  render(<SettingsAdminClient initialSnapshot={snapshot} initialServices={[]}
    catalogLocked={null} returnTo={null} />);

  expect(screen.getByLabelText("Firmenname")).toBeTruthy();
  for (const text of ["Ausschuss berechnen", "Fahrzeuge", "Sicherungsort", "Steuerberater",
    "Betriebsruhe", "Spielraum Mehrarbeit"]) {
    expect(screen.queryByText(text)).toBeNull();
  }

  fireEvent.click(screen.getByRole("button", { name: "Leistungskatalog" }));
  const vat = screen.getByLabelText("Steuersatz") as HTMLSelectElement;
  expect([...vat.options].map(option => option.value)).toEqual(["1900", "700", "0"]);
  expect(screen.queryByText(UMSATZSTEUER_EINSTELLUNG_COPY.katalogSatzNochNichtUnterstuetzt)).toBeNull();
  expect(SETTINGS_PENDING_CONSUMER_COPY.unavailable).toBeTruthy();

  cleanup();
  const unsupported = { ...snapshot, company: { ...snapshot.company,
    umsatzsteuer: { regelsatzBasispunkte: 2100, ermaessigtBasispunkte: 700 } } } as SystemSettingsSnapshot;
  render(<SettingsAdminClient initialSnapshot={unsupported} initialServices={[]}
    catalogLocked={null} returnTo={null} />);
  fireEvent.click(screen.getByRole("button", { name: "Leistungskatalog" }));
  const unsupportedOption = screen.getByRole("option", { name: /21 %.*durchgehende Verarbeitung/ }) as HTMLOptionElement;
  expect(unsupportedOption.disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Leistung speichern" }).hasAttribute("disabled")).toBe(true);
});
