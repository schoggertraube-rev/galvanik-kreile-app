export type SalesStage = 1 | 2 | 3 | 4;

export type SalesStageFeatureDefinition = {
  id: string;
  label: string;
  stage: SalesStage;
  defaultEnabled: boolean;
};

export const SALES_STAGE_FEATURES = [
  { id: "E01", label: "Datenkiste", stage: 1, defaultEnabled: true },
  { id: "E02", label: "Neu erfassen", stage: 1, defaultEnabled: true },
  { id: "E03", label: "Foto & Dokument", stage: 1, defaultEnabled: true },
  { id: "E04", label: "Dokument lesen (OCR)", stage: 1, defaultEnabled: true },
  { id: "E05", label: "Outlook-Mail rein", stage: 1, defaultEnabled: true },
  { id: "A01", label: "Der Tag", stage: 1, defaultEnabled: true },
  { id: "A02", label: "Termin-Ampel", stage: 1, defaultEnabled: true },
  { id: "A03", label: "Wochenansicht", stage: 1, defaultEnabled: true },
  { id: "A04", label: "Auftragskarte", stage: 1, defaultEnabled: true },
  { id: "A05", label: "Werkstatt", stage: 1, defaultEnabled: true },
  { id: "A06", label: "Kundenkarte", stage: 1, defaultEnabled: true },
  { id: "A07", label: "Angebot / KV", stage: 1, defaultEnabled: true },
  { id: "A08", label: "Suchleiste", stage: 1, defaultEnabled: true },
  { id: "A09", label: "Frühwarnung Termin", stage: 1, defaultEnabled: true },
  { id: "R01", label: "Outlook-Kalender", stage: 1, defaultEnabled: true },
  { id: "R02", label: "Mail raus", stage: 1, defaultEnabled: true },
  { id: "R03", label: "Rechnung", stage: 1, defaultEnabled: true },
  { id: "R04", label: "Zahlung", stage: 1, defaultEnabled: true },
  { id: "R05", label: "Ware raus & Lieferschein", stage: 1, defaultEnabled: true },
  { id: "S01", label: "Firmendaten & Nummernkreise", stage: 1, defaultEnabled: true },
  { id: "S02", label: "Leistungskatalog", stage: 1, defaultEnabled: true },
  { id: "S03", label: "Nutzer & Rollen", stage: 1, defaultEnabled: true },
  { id: "R06", label: "Export Steuerberater", stage: 2, defaultEnabled: false },
  { id: "B01", label: "Bankabgleich", stage: 2, defaultEnabled: false },
  { id: "B02", label: "Mahnwesen", stage: 2, defaultEnabled: false },
  { id: "B03", label: "Mails automatisch zuordnen", stage: 2, defaultEnabled: false },
  { id: "B04", label: "Buchhaltung", stage: 2, defaultEnabled: false },
  { id: "B05", label: "Status-Link für Kunden", stage: 2, defaultEnabled: false },
  { id: "W01", label: "Galvanik-Stufen", stage: 3, defaultEnabled: false },
  { id: "W02", label: "Material & Einkauf", stage: 3, defaultEnabled: false },
  { id: "W04", label: "Versand DHL", stage: 3, defaultEnabled: false },
  { id: "W05", label: "Begleitschein & Etiketten", stage: 3, defaultEnabled: false },
  { id: "Z01", label: "Zahlen", stage: 4, defaultEnabled: false },
  { id: "Z03", label: "Spracheingabe", stage: 4, defaultEnabled: false },
  { id: "Z04", label: "Kapazitätsplanung", stage: 4, defaultEnabled: false },
] as const satisfies readonly SalesStageFeatureDefinition[];

export type SalesStageFeatureId = typeof SALES_STAGE_FEATURES[number]["id"];
export type SalesStageFeature = { id: SalesStageFeatureId; enabled: boolean };

export function isFeatureEnabled(id: SalesStageFeatureId, features: readonly SalesStageFeature[]): boolean {
  return features.find((feature) => feature.id === id)?.enabled === true;
}
