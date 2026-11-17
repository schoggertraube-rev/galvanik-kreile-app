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

/** PLAN S21 table6 + VORAB(c)V1/V4. Sales stages remain separate. */
export const PACKAGE_SWITCHES = [
  {
    "id": "ui_v45",
    "defaultEnabled": false
  },
  {
    "id": "logging",
    "defaultEnabled": false
  },
  {
    "id": "p2_eingang",
    "defaultEnabled": false
  },
  {
    "id": "p2_nachrichten",
    "defaultEnabled": false
  },
  {
    "id": "p2_kv",
    "defaultEnabled": false
  },
  {
    "id": "p3_karten",
    "defaultEnabled": false
  },
  {
    "id": "p3_werkstatt",
    "defaultEnabled": false
  },
  {
    "id": "p4_ausgang",
    "defaultEnabled": false
  },
  {
    "id": "p4_geld",
    "defaultEnabled": false
  },
  {
    "id": "p4_reklamation",
    "defaultEnabled": false
  },
  {
    "id": "p5_tag",
    "defaultEnabled": false
  },
  {
    "id": "p5_suche",
    "defaultEnabled": false
  },
  {
    "id": "p5_einstellungen",
    "defaultEnabled": false
  },
  {
    "id": "p5_uebersetzen",
    "defaultEnabled": false
  },
  {
    "id": "offline_24h",
    "defaultEnabled": false
  },
  {
    "id": "tag_anordnen",
    "defaultEnabled": false
  },
  {
    "id": "tag_notizen",
    "defaultEnabled": false
  }
] as const;
export type PackageSwitchId = typeof PACKAGE_SWITCHES[number]["id"];
export type PackageSwitchValues = Record<PackageSwitchId, boolean>;

export type PackageSwitchRow={id:string;enabled:boolean;roles:string[]|null};
const packageSwitchIds=new Set<string>(PACKAGE_SWITCHES.map(({id})=>id));
export function validatePackageSwitchRow(value:unknown):asserts value is PackageSwitchRow{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('PACKAGE_SWITCH_SOURCE_INVALID');
 const row=value as Record<string,unknown>;
 if(typeof row.id!=='string'||!packageSwitchIds.has(row.id)||typeof row.enabled!=='boolean'||row.roles!==null&&(!Array.isArray(row.roles)||row.roles.some(role=>typeof role!=='string')||row.id!=='offline_24h'&&row.roles.length!==0))throw Error('PACKAGE_SWITCH_SOURCE_INVALID');
}
/** One pure projector for the existing rights SQL and settings flag source. */
export function mapPackageSwitchRows(source:unknown):PackageSwitchValues{
 if(!Array.isArray(source)||source.length!==PACKAGE_SWITCHES.length)throw Error('PACKAGE_SWITCH_SET_INCOMPLETE');
 const found:PackageSwitchRow[]=source.map(row=>{validatePackageSwitchRow(row);return row;});
 if(new Set(found.map(row=>row.id)).size!==PACKAGE_SWITCHES.length)throw Error('PACKAGE_SWITCH_SET_INCOMPLETE');
 return Object.fromEntries(found.map(row=>[row.id,row.enabled])) as PackageSwitchValues;
}
