import { expect, it } from "vitest";
import { readAzurePositionRows } from "../server/intakeRecognitionPositions";

it("reads provider table rows in order and keeps confidence unknown for an unscored cell", () => {
  const rows = readAzurePositionRows([{ cells: [
    { rowIndex: 0, columnIndex: 0, kind: "columnHeader", content: "Artikelnummer" },
    { rowIndex: 0, columnIndex: 1, kind: "columnHeader", content: "Menge" },
    { rowIndex: 0, columnIndex: 2, kind: "columnHeader", content: "Einheit" },
    { rowIndex: 2, columnIndex: 0, content: "TEST-2", confidence: 0.92 },
    { rowIndex: 2, columnIndex: 1, content: "unlesbar" },
    { rowIndex: 1, columnIndex: 0, content: "TEST-1", confidence: 0.96 },
    { rowIndex: 1, columnIndex: 1, content: "4,25", confidence: 0.8 },
    { rowIndex: 1, columnIndex: 2, content: "kg", confidence: 0.9 },
  ] }]);

  expect(rows).toMatchObject([
    { source: { tableIndex: 0, rowIndex: 1 }, confidence: 0.8,
      position: { lieferantenArtikelNr: "TEST-1", menge: "4.25", einheitText: "kg" } },
    { source: { tableIndex: 0, rowIndex: 2 }, confidence: null,
      position: { lieferantenArtikelNr: "TEST-2", menge: null, einheitText: null } },
  ]);
});
