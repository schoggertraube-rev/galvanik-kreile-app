import { expect, test, vi } from "vitest";
import { leseLagerArtikelAltvertrag } from "../server-bestand";

const abnahme = vi.hoisted(() => ({ execute: vi.fn(), protokoll: vi.fn() }));

vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: async () => ({
    ok: true,
    data: { role: "admin", active: true, tenantId: "TEST-lager", packageSwitches: { p4_lager: true } },
  }),
}));

vi.mock("@/lib/server/privilegedDb", () => ({
  withPrivilegedTenantTransaction: async (_auth: unknown, lies: (tx: { execute: typeof abnahme.execute }) => Promise<unknown>) =>
    lies({ execute: abnahme.execute }),
}));

vi.mock("@/lib/server/actionObservation", () => ({ recordObservedFailure: abnahme.protokoll }));

test("Eine fehlende Bewertungsmethode lässt den Bestand lesbar und den Preis leer", async () => {
  abnahme.execute.mockResolvedValueOnce([{
    id: "TEST-ARTIKEL", name: "TEST Lagerbestand", category: "chemical", unit: "kg",
    minStock: null, currentStock: "4", availableStock: "4", pricePerUnit: null,
  }]);
  const liesEinstellungen = vi.fn().mockResolvedValue({ bilanzbewertung_methode: null });

  expect(await leseLagerArtikelAltvertrag(liesEinstellungen, "TEST-ARTIKEL")).toMatchObject({
    ok: true,
    data: [{ id: "TEST-ARTIKEL", currentStock: 4, pricePerUnit: null }],
  });
  expect(liesEinstellungen).toHaveBeenCalledWith("TEST-lager", { execute: abnahme.execute });
  expect(abnahme.protokoll).toHaveBeenCalledWith("LAGER_BEWERTUNGSMETHODE_FEHLT");
});
