import "server-only";
import type { LagerBelegPosition } from "@/modules/lager/public";

type PositionValues = Omit<LagerBelegPosition, "positionKey" | "sicherheit">;
type AzureCell = { rowIndex: number; columnIndex: number; content: string; kind?: unknown; confidence?: unknown };

const fields = new Map<string, keyof PositionValues>([
  ["bezeichnung", "bezeichnung"], ["beschreibung", "bezeichnung"], ["description", "bezeichnung"],
  ["artikelnummer", "lieferantenArtikelNr"], ["artikelnr", "lieferantenArtikelNr"],
  ["lieferantenartikelnummer", "lieferantenArtikelNr"], ["item number", "lieferantenArtikelNr"],
  ["ean", "ean"], ["menge", "menge"], ["quantity", "menge"],
  ["einheit", "einheitText"], ["unit", "einheitText"], ["einzelpreis", "einzelpreis"], ["unit price", "einzelpreis"],
  ["preisbezugsmenge", "preisBezugMenge"], ["rabatt", "rabattProzent"], ["rabatt prozent", "rabattProzent"],
  ["positionsnetto", "positionsNetto"], ["netto", "positionsNetto"], ["net amount", "positionsNetto"],
]);

function isCell(value: unknown): value is AzureCell {
  if (!value || typeof value !== "object") return false;
  const cell = value as Partial<AzureCell>;
  return typeof cell.rowIndex === "number" && Number.isSafeInteger(cell.rowIndex) && cell.rowIndex >= 0
    && typeof cell.columnIndex === "number" && Number.isSafeInteger(cell.columnIndex) && cell.columnIndex >= 0
    && typeof cell.content === "string";
}

function numericText(value: string | undefined, places: number) {
  if (value === undefined || !/^-?\d+(?:[.,]\d+)?$/u.test(value)) return null;
  const normalized = value.replace(",", ".");
  return (normalized.split(".")[1]?.length ?? 0) <= places ? normalized : null;
}

export function readAzurePositionRows(tables: readonly unknown[]) {
  return tables.flatMap((table, tableIndex) => {
    if (!table || typeof table !== "object" || !("cells" in table) || !Array.isArray(table.cells)) return [];
    const columns = new Map<number, keyof PositionValues>();
    const rows = new Map<number, AzureCell[]>();
    const headerRows = new Set<number>();
    for (const cell of table.cells.filter(isCell)) {
      if (cell.kind === "columnHeader") {
        headerRows.add(cell.rowIndex);
        const name = cell.content.normalize("NFKC").toLocaleLowerCase("de-DE").replace(/[^\p{L}\p{N} ]/gu, "").trim();
        const field = fields.get(name);
        if (field !== undefined) columns.set(cell.columnIndex, field);
      } else {
        const row = rows.get(cell.rowIndex);
        if (row) row.push(cell);
        else rows.set(cell.rowIndex, [cell]);
      }
    }

    return [...rows].sort(([left], [right]) => left - right).flatMap(([rowIndex, cells]) => {
      if (headerRows.has(rowIndex)) return [];
      const values: Partial<Record<keyof PositionValues, string>> = {};
      let confidence: number | null = 1;
      for (const cell of cells) {
        const field = columns.get(cell.columnIndex);
        const value = cell.content.trim();
        if (field !== undefined && value) values[field] = value;
        const score = cell.confidence;
        confidence = confidence !== null && typeof score === "number" && score >= 0 && score <= 1
          ? Math.min(confidence, score) : null;
      }
      const position: PositionValues = {
        bezeichnung: values.bezeichnung?.slice(0, 500) ?? null,
        lieferantenArtikelNr: values.lieferantenArtikelNr ?? null,
        ean: values.ean && /^(?:\d{8}|\d{12,14})$/u.test(values.ean) ? values.ean : null,
        menge: numericText(values.menge, 3),
        einheitText: values.einheitText ?? null,
        einzelpreis: numericText(values.einzelpreis, 4),
        preisBezugMenge: numericText(values.preisBezugMenge, 3),
        rabattProzent: numericText(values.rabattProzent, 4),
        positionsNetto: numericText(values.positionsNetto, 4),
      };
      return [{ position, confidence, source: { tableIndex, rowIndex } }];
    });
  });
}
