import { beforeEach, expect, test, vi } from "vitest";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({
  withPrivilegedTenantTransaction: async (_context: unknown, work: (tx: { execute: typeof execute }) => unknown) => work({ execute }),
}));

import { meldeAusschuss } from "../ausschuss";

const auth: AuthorizationSnapshot = {
  userId: "11111111-1111-4111-8111-111111111111", tenantId: "TEST-Ausschuss",
  displayName: "TEST Werkstatt", role: "werkstatt", active: true, permissions: ["perm_op_status"], areas: ["auftraege"],
  packageSwitches: { p3_werkstatt: true } as AuthorizationSnapshot["packageSwitches"],
};
const eingabe = {
  auftragId: "TEST-Auftrag", itemId: "TEST-Teil", menge: 3, grund: "TEST Oberfläche",
  clientEventId: "22222222-2222-4222-8222-222222222222",
};

function ladePosition(einheit: string, abrechnungsmenge: string) {
  execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([
    { itemId: eingabe.itemId, abrechnungsmenge, einheit, version: 4, station: "galvanik" },
  ]);
}

beforeEach(() => execute.mockReset());

test.each(["kg", "dm²", "Satz"])("Ausschuss je %s braucht eine ausdrücklich gezählte Stückzahl", async (einheit) => {
  ladePosition(einheit, "10");
  const aktualisiereAnliegen = vi.fn(async () => {});
  const antwort = await meldeAusschuss(auth, eingabe, {
    sperrendeRechnung: async () => null,
    aktualisiereAnliegen,
  });
  expect(antwort).toEqual({
    code: "STUECKZAHL_FEHLT", message: `Gib die Gesamtzahl der Teile an. Diese Position wird in ${einheit} abgerechnet.`,
  });
  expect(execute).toHaveBeenCalledTimes(3);
  expect(aktualisiereAnliegen).not.toHaveBeenCalled();
});

test("Eine bestehende Rechnung sperrt die Ausschussmeldung vor jeder Änderung", async () => {
  ladePosition("Stück", "10");
  const aktualisiereAnliegen = vi.fn(async () => {});
  const antwort = await meldeAusschuss(auth, eingabe, {
    sperrendeRechnung: async () => "R-2026-0001",
    aktualisiereAnliegen,
  });
  expect(antwort).toEqual({
    code: "CONFLICT", message: "Ausschuss ist nicht mehr änderbar. Rechnung R-2026-0001 ist erstellt.",
  });
  expect(execute).toHaveBeenCalledTimes(3);
  expect(aktualisiereAnliegen).not.toHaveBeenCalled();
});

test("Ausschuss über der gezählten Stückzahl hinterlässt keine Meldung", async () => {
  ladePosition("kg", "12.5");
  const aktualisiereAnliegen = vi.fn(async () => {});
  const antwort = await meldeAusschuss(auth, { ...eingabe, menge: 5, gesamtStueck: 4 }, {
    sperrendeRechnung: async () => null,
    aktualisiereAnliegen,
  });
  expect(antwort).toEqual({ code: "VALIDATION_ERROR", message: "Gib 0 bis 4 Teile als Ausschuss ein." });
  expect(execute).toHaveBeenCalledTimes(3);
  expect(aktualisiereAnliegen).not.toHaveBeenCalled();
});

test("Eine begründete Korrektur auf null setzt vollständigen Ausschuss zurück", async () => {
  ladePosition("Stück", "10");
  execute.mockResolvedValueOnce([{ id: eingabe.auftragId }]).mockResolvedValueOnce([{ id: "TEST-Ereignis" }])
    .mockResolvedValueOnce([{ itemId: eingabe.itemId, menge: "0" }]);
  const aktualisiereAnliegen = vi.fn(async () => {});
  expect(await meldeAusschuss(auth, { ...eingabe, menge: 0 }, {
    sperrendeRechnung: async () => null,
    aktualisiereAnliegen,
  })).toMatchObject({ code: "OK", quittung: { itemId: eingabe.itemId, menge: 0, gesamt: "10", version: 5 } });
  expect(aktualisiereAnliegen).toHaveBeenCalledWith(expect.anything(), auth, {
    auftragId: eingabe.auftragId, clientEventId: eingabe.clientEventId, vollstaendig: false,
  });
});

test.each([{ menge: 3, vollstaendig: false }, { menge: 4, vollstaendig: true }])(
  "Das Abrechnungsgewicht bleibt bei $menge von vier Ausschussteilen erhalten", async ({ menge, vollstaendig }) => {
  ladePosition("kg", "12.5");
  execute.mockResolvedValueOnce([{ id: eingabe.auftragId }]).mockResolvedValueOnce([{ id: "TEST-Ereignis" }])
    .mockResolvedValueOnce([{ itemId: eingabe.itemId, menge: String(menge), gesamt: "4" }]);
  const aktualisiereAnliegen = vi.fn(async () => {});
  expect(await meldeAusschuss(auth, { ...eingabe, menge, gesamtStueck: 4 }, {
    sperrendeRechnung: async () => null,
    aktualisiereAnliegen,
  })).toMatchObject({ code: "OK", quittung: { itemId: eingabe.itemId, menge, gesamt: "4" } });
  expect(aktualisiereAnliegen).toHaveBeenCalledWith(expect.anything(), auth, {
    auftragId: eingabe.auftragId, clientEventId: eingabe.clientEventId, vollstaendig,
  });
});
