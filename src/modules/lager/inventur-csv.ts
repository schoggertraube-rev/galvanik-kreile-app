export type InventurCsvZeile = Readonly<{
  kurznummer: number | null;
  artikelName: string | null;
  ist: string | null;
  einheit: string | null;
  stockwerk: string | null;
  bereich: string | null;
  ek: string | null;
  preisquelle: string | null;
  wertEur: string | null;
}>;

const kopf = ["kurznr", "artikel", "menge", "einheit", "ort", "ek", "ek_quelle", "wert"];

function zelle(wert: string): string {
  return /[;"\r\n]/u.test(wert) ? `"${wert.replaceAll('"', '""')}"` : wert;
}

export function inventurCsvTextzelle(wert: string | null): string {
  const text = wert ?? "";
  return zelle(/^[\s]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text) ? `'${text}` : text);
}

export function inventurCsvDezimal(wert: string | null): string {
  return wert?.replace(".", ",") ?? "";
}

/** Erstellt den unveränderlichen Inventurabschluss im prüfbaren CSV-Format. */
export function erstelleLagerInventurCsv(zeilen: readonly InventurCsvZeile[]): Uint8Array {
  const inhalt = [kopf.join(";")];
  for (const zeile of zeilen) {
    inhalt.push([
      zeile.kurznummer?.toString() ?? "",
      inventurCsvTextzelle(zeile.artikelName),
      inventurCsvDezimal(zeile.ist),
      inventurCsvTextzelle(zeile.einheit),
      inventurCsvTextzelle([zeile.stockwerk, zeile.bereich].filter(Boolean).join(" / ")),
      inventurCsvDezimal(zeile.ek),
      inventurCsvTextzelle(zeile.preisquelle),
      inventurCsvDezimal(zeile.wertEur),
    ].join(";"));
  }
  return new TextEncoder().encode(`\uFEFF${inhalt.join("\r\n")}\r\n`);
}
