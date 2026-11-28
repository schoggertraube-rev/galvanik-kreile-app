import "server-only";
import type { LagerBelegPosition } from "@/modules/lager/public";

type PositionValues = Omit<LagerBelegPosition, "positionKey" | "sicherheit">;
type AzureCell = { rowIndex: number; columnIndex: number; content: string; kind?: unknown; confidence?: unknown; boundingRegions?: unknown };

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

function pageOf(regions: readonly unknown[]): number | null {
  let page: number | null = null;
  for (const region of regions) {
    const number = region && typeof region === 'object' && 'pageNumber' in region ? region.pageNumber : null;
    if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 1 || page !== null && page !== number) return null;
    page = number;
  }
  return page;
}

export function readIntakePositionValues(values: Partial<Record<keyof PositionValues, unknown>>): PositionValues {
  const text = (field: keyof PositionValues) => typeof values[field] === 'string' ? values[field].trim() || undefined : undefined;
  const ean = text('ean');

  return {
    bezeichnung: text('bezeichnung')?.slice(0, 500) ?? null,
    lieferantenArtikelNr: text('lieferantenArtikelNr') ?? null,
    ean: ean && /^(?:\d{8}|\d{12,14})$/u.test(ean) ? ean : null,
    menge: numericText(text('menge'), 3),
    einheitText: text('einheitText') ?? null,
    einzelpreis: numericText(text('einzelpreis'), 4),
    preisBezugMenge: numericText(text('preisBezugMenge'), 3),
    rabattProzent: numericText(text('rabattProzent'), 4),
    positionsNetto: numericText(text('positionsNetto'), 4),
  };
}

export function readAzurePositionRows(tables: readonly unknown[]) {
  return tables.flatMap((table, tableIndex) => {
    if (!table || typeof table !== "object" || !("cells" in table) || !Array.isArray(table.cells)) return [];
    const tablePage = 'boundingRegions' in table && Array.isArray(table.boundingRegions) ? pageOf(table.boundingRegions) : null;
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
      const position = readIntakePositionValues(values);
      if (!Object.values(position).some(value => value !== null)) return [];
      const rowRegions = cells.flatMap(cell => Array.isArray(cell.boundingRegions) ? cell.boundingRegions : []);
      const page = rowRegions.length ? pageOf(rowRegions) : tablePage;
      return [{ position, confidence, source: { tableIndex, rowIndex, page } }];
    });
  });
}
