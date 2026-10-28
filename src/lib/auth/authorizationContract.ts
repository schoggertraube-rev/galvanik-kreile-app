export const APP_ROLES = [
  "developer",
  "admin",
  "meister",
  "buero",
  "werkstatt",
  "readonly",
] as const;

export type AppRole = typeof APP_ROLES[number];

export type PermissionKey =
  | "perm_sys_toggles"
  | "perm_sys_diag"
  | "perm_sys_users"
  | "perm_data_csv"
  | "perm_data_customers"
  | "perm_data_orders"
  | "perm_op_status"
  | "perm_op_risk"
  | "perm_op_photos"
  | "perm_op_qa"
  | "perm_cash_pickup"
  | "perm_view_leitstand"
  | "perm_view_customers"
  | "perm_view_prices";

export const ACCESS_AREAS = [
  "auftraege",
  "eingang",
  "kunden",
  "geld",
  "kassieren",
  "mails",
  "einstellungen",
  "logins",
  "wartung",
] as const;

export type AccessArea = typeof ACCESS_AREAS[number];

export const ACCESS_AREA_LABELS: Record<AccessArea, { text: string; sub?: string }> = {
  auftraege: { text: "Aufträge & Werkstatt", sub: "sehen, Fertig melden, Mehrarbeit, Fotos" },
  eingang: { text: "Neuer Eingang & Kunde anlegen" },
  kunden: { text: "Kunden & Kontakt" },
  geld: { text: "Geld, Preise & Buchhaltung", sub: "Beträge, Rechnungen, Zahlungen, Preise, Zahlungsbedingungen" },
  kassieren: { text: "Kassieren bei Abholung", sub: "Betrag sehen und bezahlt (bar / Karte) bestätigen – ohne Buchhaltung" },
  mails: { text: "Mails lesen & zuordnen" },
  einstellungen: { text: "Firmen-Einstellungen", sub: "Firmendaten, Katalog, Stundensatz" },
  logins: { text: "Logins & Rechte verwalten" },
  wartung: { text: "Wartung, Stufen & Anbindungen" },
};

export const ROLE_ACCESS_AREA_TEMPLATES: Record<AppRole, readonly AccessArea[]> = {
  developer: ["einstellungen", "logins", "wartung"],
  admin: ACCESS_AREAS,
  meister: ["auftraege", "eingang", "kunden", "geld", "mails", "einstellungen", "kassieren", "logins"],
  buero: ["auftraege", "eingang", "kunden", "geld", "mails", "einstellungen"],
  werkstatt: ["auftraege", "eingang", "kunden"],
  readonly: [],
};

const DEVELOPER_BUSINESS_AREAS = [
  "auftraege",
  "eingang",
  "kunden",
  "geld",
  "kassieren",
  "mails",
] as const satisfies readonly AccessArea[];

/**
 * Roles are only defaults, except for the developer safety boundary: a
 * developer is not an employee and can never receive business operations.
 * Both the matrix and server authorization use this policy.
 */
export function isAccessAreaAllowedForRole(role: AppRole, area: AccessArea): boolean {
  return role !== "developer"
    || !(DEVELOPER_BUSINESS_AREAS as readonly AccessArea[]).includes(area);
}

export function normalizeAccessAreasForRole(
  role: AppRole,
  areas: readonly AccessArea[],
): AccessArea[] {
  return [...new Set(areas.filter((area) => isAccessAreaAllowedForRole(role, area)))];
}

export function getFixedAccessAreasForRole(role: AppRole): readonly AccessArea[] {
  return role === "developer" ? ROLE_ACCESS_AREA_TEMPLATES.developer : [];
}

const ACCESS_AREA_PERMISSIONS: Record<AccessArea, readonly PermissionKey[]> = {
  auftraege: ["perm_op_status", "perm_op_risk", "perm_op_photos", "perm_op_qa", "perm_view_leitstand"],
  eingang: ["perm_data_orders"],
  kunden: ["perm_data_customers", "perm_view_customers"],
  geld: ["perm_data_csv", "perm_view_prices"],
  kassieren: ["perm_cash_pickup"],
  mails: [],
  einstellungen: ["perm_sys_toggles"],
  logins: ["perm_sys_users"],
  wartung: ["perm_sys_toggles", "perm_sys_diag"],
};

export function isAccessArea(value: unknown): value is AccessArea {
  return typeof value === "string" && (ACCESS_AREAS as readonly string[]).includes(value);
}

export function getPermissionsForAreas(areas: readonly AccessArea[]): readonly PermissionKey[] {
  return [...new Set(areas.flatMap((area) => ACCESS_AREA_PERMISSIONS[area]))];
}

export type ProductIdentityKey = "rolf" | "phillip" | "gregor";

/** Product labels are separate from the authenticated actor and role contract. */
export type ProductIdentityByKey = {
  rolf: { name: "Rolf"; responsibility: "Meister"; initials: "R" };
  phillip: { name: "Phillip"; responsibility: "Werkstatt"; initials: "P" };
  gregor: {
    name: "Gregor";
    responsibility: "Systemadministrator";
    initials: "G";
  };
};

export type ProductIdentity = ProductIdentityByKey[ProductIdentityKey];

export const ROLE_LABELS: Record<AppRole, string> = {
  developer: "Entwickler",
  admin: "Administrator",
  meister: "Meister",
  buero: "Büro",
  werkstatt: "Werkstatt",
  readonly: "Nur Leserechte",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

export function getRoleLabel(role: AppRole): string {
  return ROLE_LABELS[role] || role;
}

const PRODUCT_IDENTITIES: ProductIdentityByKey = {
  rolf: { name: "Rolf", responsibility: "Meister", initials: "R" },
  phillip: { name: "Phillip", responsibility: "Werkstatt", initials: "P" },
  gregor: { name: "Gregor", responsibility: "Systemadministrator", initials: "G" },
};

/** Browser-safe label lookup. Actor/configuration validation is server-only. */
export function getProductIdentityByKey<Key extends ProductIdentityKey>(
  key: Key,
): ProductIdentityByKey[Key] {
  return PRODUCT_IDENTITIES[key];
}
