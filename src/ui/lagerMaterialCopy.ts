export const LAGER_MATERIAL_COPY = {
  rechnungsposition: (artikel: string) => `Material: ${artikel}`,
  preisFehlt: (artikel: string) => `Preis für ${artikel} fehlt`,
  preisUngueltig: (eingabe: string, einheit: string) =>
    `${eingabe} ist kein Preis. Gib den Preis je ${einheit} ein, z. B. 3,40 €.`,
  preisNull: (einheit: string) => `0 € ist kein Preis. Gib den Preis je ${einheit} ein.`,
  preisrechtFehlt: (artikel: string) =>
    `Den Preis für ${artikel} hinterlegt Preise & Rechnungen. Die Aufgabe liegt dort, die Rechnung wartet darauf.`,
  preiseinheitPasstNicht: (preiseinheit: string, einheit: string) =>
    `Der Preis gilt je ${preiseinheit}, gebucht wird in ${einheit}.`,
  umrechnungFestlegen: (einheit: string, preiseinheit: string) => `Umrechnung ${einheit} → ${preiseinheit} festlegen`,
  rechnungseinheitFehlt: (einheit: string) => `Für ${einheit} fehlt der Code der E-Rechnung.`,
  rechnungseinheitWaehlen: (einheit: string) => `Code für ${einheit} wählen`,
  rechnungAusgestellt: (nummer: string) => `Rechnung ${nummer} ist ausgestellt – Korrektur über die Rechnung`,
};
