export const LAGER_STAMM_COPY = {
  ausgeschaltet: "Schalte Inventur oder Lagerführung in den Einstellungen ein.",
  entwurf: "Artikelentwurf",
  aufgabenweg: "Prüfe und übernimm den Artikel im Lager.",
  rechtFehlt: "Du brauchst das Recht für Lagerstammdaten.",
  vorAbschluss: "Übernimm den Artikelentwurf zuerst.",
  pruefaufgabe: (name: string) => `Artikel ${name} prüfen und übernehmen`,
  bestandKlaeren: (name: string) => `Bestand von ${name} klären`,
  bestandEndetMitBuchung: "Bestandsklärung endet mit der Lagerbuchung.",
} as const;
