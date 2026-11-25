import { describe, expect, it } from "vitest";
import { leseLagerBuchungsauftrag } from "../lagerBuchungsauftrag";

const ids = {
  befehl: "00000000-0000-4000-8000-000000000001",
  quellort: "00000000-0000-4000-8000-000000000002",
  zielort: "00000000-0000-4000-8000-000000000003",
} as const;

const auftrag = {
  befehlId: ids.befehl,
  inventoryItemId: "TEST-ARTIKEL",
  movementType: "move",
  quantity: "2",
  einheit: "stk",
  ortId: ids.quellort,
  fachzeit: "2026-11-25T10:00:00.000Z",
  revision: 1,
  mengenqualitaet: "exakt",
  geschaeftsgrund: "umlagerung",
  zielOrtId: ids.zielort,
} as const;

describe("Lager-Buchungsauftrag für B1a-3", () => {
  it("liest eine Umlagerung nur mit eigenem Zielort", () => {
    expect(leseLagerBuchungsauftrag(auftrag)).toMatchObject({
      movementType: "move",
      geschaeftsgrund: "umlagerung",
      zielOrtId: ids.zielort,
      quantity: "2",
    });
  });

  it("weist fehlenden oder unzulässigen Zielort und Auftrag bei Umlagerung ab", () => {
    expect(leseLagerBuchungsauftrag({ ...auftrag, zielOrtId: undefined })).toBeNull();
    expect(leseLagerBuchungsauftrag({ ...auftrag, zielOrtId: ids.quellort })).toBeNull();
    expect(leseLagerBuchungsauftrag({ ...auftrag, orderId: "TEST-AUFTRAG" })).toBeNull();
  });

  it("hält die bisherige Badzugabe getrennt von der Umlagerung", () => {
    expect(leseLagerBuchungsauftrag({
      ...auftrag,
      geschaeftsgrund: "badzugabe",
      zielOrtId: undefined,
      badProzessOrtId: ids.zielort,
    })).toMatchObject({ badProzessOrtId: ids.zielort });
  });
});
