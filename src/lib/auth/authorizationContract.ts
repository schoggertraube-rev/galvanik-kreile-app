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

export const AUTHORIZATION_ACTIONS = [
  "confirmPayment",
  "editOrderContent",
  "createCustomer",
  "createQuote",
] as const;

export type AuthorizationAction = typeof AUTHORIZATION_ACTIONS[number];
export type AuthorizationActionGrants = Record<AuthorizationAction, boolean>;

/** U-249 operational IDs: one pure rights contract, without loading a live DB resolver. */
export const QUOTE_OPERATION_ACTION_IDS:readonly string[]=['quote.accept','quote.extend','quote.convert','quote.return_goods'];

export const ACCESS_AREAS = [
  "auftraege",
  "eingang",
  "kunden",
  "preise",
  "zahlungen",
  "buchhaltung",
  "kassieren",
  "mails",
  "entscheiden",
  "einstellungen",
  "logins",
  "wartung",
  "statistik_alle",
  "protokoll",
] as const;

export type AccessArea = typeof ACCESS_AREAS[number];

export const ACCESS_AREA_LABELS: Record<AccessArea, { text: string; sub?: string }> = {
  auftraege: { text: "Aufträge & Werkstatt", sub: "sehen, Fertig melden, Mehrarbeit, Fotos" },
  eingang: { text: "Neu erfassen & Kunde anlegen" },
  kunden: { text: "Kunden & Kontakt" },
  preise: { text: "Preise & Rechnungen", sub: "Preise in KV, Auftrag und Rechnung; Rechnung ausstellen und senden" },
  zahlungen: { text: "Zahlungen & Mahnungen", sub: "Zahlungen buchen, offene Posten, Mahnung, Storno, Guthaben" },
  buchhaltung: { text: "Buchhaltung & Zahlen", sub: "Eingangsrechnungen, Buchhaltung, Kontostand, Auswertungen, Export" },
  kassieren: { text: "Kassieren bei Abholung", sub: "Betrag sehen und bezahlt (bar / Karte) bestätigen – ohne Buchhaltung" },
  mails: { text: "Mails lesen & zuordnen" },
  entscheiden: { text: "Abweichungen & Reklamationen entscheiden", sub: "Ware unbearbeitet zurückgeben, Abweichungen freigeben, Reklamation bewerten" },
  einstellungen: { text: "Firmen-Einstellungen", sub: "Firmendaten, Katalog, Stundensatz" },
  logins: { text: "Logins & Rechte verwalten" },
  statistik_alle: { text: "Statistik aller Personen" },
  wartung: { text: "Wartung, Stufen & Anbindungen" },
  protokoll: { text: "Protokoll" },
};

export const ROLE_ACCESS_AREA_TEMPLATES: Record<AppRole, readonly AccessArea[]> = {
  developer: ["einstellungen", "logins", "wartung", "protokoll"],
  admin: ACCESS_AREAS.filter((area) => area !== "wartung" && area !== "entscheiden"),
  meister: ["auftraege", "eingang", "kunden", "preise", "zahlungen", "buchhaltung", "mails", "einstellungen", "kassieren", "logins", "entscheiden"],
  buero: ["auftraege", "eingang", "kunden", "preise", "zahlungen", "mails", "einstellungen"],
  werkstatt: ["auftraege", "eingang", "kunden"],
  readonly: [],
};

const DEVELOPER_BUSINESS_AREAS = [
  "auftraege",
  "eingang",
  "kunden",
  "preise",
  "zahlungen",
  "buchhaltung",
  "kassieren",
  "mails",
  "entscheiden",
  "statistik_alle",
] as const satisfies readonly AccessArea[];

const BLOCKED_ACCESS_AREAS_BY_ROLE: Record<AppRole, readonly AccessArea[]> = {
  developer: DEVELOPER_BUSINESS_AREAS,
  admin: [],
  meister: [],
  buero: [],
  werkstatt: [],
  readonly: [],
};

const FIXED_ACCESS_AREAS_BY_ROLE: Record<AppRole, readonly AccessArea[]> = {
  developer: ROLE_ACCESS_AREA_TEMPLATES.developer,
  admin: [],
  meister: [],
  buero: [],
  werkstatt: [],
  readonly: [],
};

/**
 * Roles are only defaults, except for the developer safety boundary: a
 * developer is not an employee and can never receive business operations.
 * Both the matrix and server authorization use this policy.
 */
export function isAccessAreaAllowedForRole(role: AppRole, area: AccessArea): boolean {
  if (area === "wartung") return FIXED_ACCESS_AREAS_BY_ROLE[role].includes(area);
  return !BLOCKED_ACCESS_AREAS_BY_ROLE[role].includes(area);
}

export function normalizeAccessAreasForRole(
  role: AppRole,
  areas: readonly AccessArea[],
): AccessArea[] {
  return [...new Set(areas.filter((area) => isAccessAreaAllowedForRole(role, area)))];
}

export function getFixedAccessAreasForRole(role: AppRole): readonly AccessArea[] {
  return FIXED_ACCESS_AREAS_BY_ROLE[role];
}

const ACCESS_AREA_PERMISSIONS: Record<AccessArea, readonly PermissionKey[]> = {
  protokoll: [],
  statistik_alle: [],
  auftraege: ["perm_op_status", "perm_op_risk", "perm_op_photos", "perm_op_qa", "perm_view_leitstand"],
  eingang: ["perm_data_orders"],
  kunden: ["perm_data_customers", "perm_view_customers"],
  preise: ["perm_view_prices"],
  zahlungen: [],
  buchhaltung: ["perm_data_csv"],
  kassieren: ["perm_cash_pickup"],
  mails: [],
  entscheiden: [],
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

/** Developer access uses its dedicated code path, never a managed PIN. */
export function canUsePinLogin(value: unknown): value is Exclude<AppRole, "developer"> {
  return isAppRole(value) && value !== "developer";
}

/** Existing management rights remain required by the caller. */
export function canManageUserTarget(actorId: string, targetId: string, targetRole: unknown): boolean {
  return isAppRole(targetRole) && (targetRole !== "developer" || actorId === targetId);
}

export function getRoleLabel(role: AppRole): string {
  return ROLE_LABELS[role] || role;
}

/** Live snapshots use app_user_rights. The role template is only a compatibility
 * fallback for older isolated fixtures that predate the areas field. */
export function hasAuthorizationArea(
  authorization: {areas?:readonly AccessArea[];role:AppRole},
  area: AccessArea,
): boolean {
  return isAccessAreaAllowedForRole(authorization.role, area) && (authorization.areas === undefined
    ? ROLE_ACCESS_AREA_TEMPLATES[authorization.role].includes(area)
    : authorization.areas.includes(area));
}

/** Canonical pure gates shared by writers and read projections. */
export function canReadComplaintOrderChoices(auth:Parameters<typeof hasAuthorizationArea>[0]){return hasAuthorizationArea(auth,'auftraege');}
export function canTransportInvoiceDocument(auth:Parameters<typeof hasAuthorizationArea>[0]){return hasAuthorizationArea(auth,'preise');}
export function canAssignIntakeCustomer(auth:Parameters<typeof hasAuthorizationArea>[0]){return hasAuthorizationArea(auth,'eingang')&&hasAuthorizationArea(auth,'kunden');}

/** PL17.11 13:01: financial task recipients do not grant their contents to another area. */
export function canReadTaskArea(auth:Parameters<typeof hasAuthorizationArea>[0],area:AccessArea|null){
 return area!=='preise'&&area!=='zahlungen'&&area!=='buchhaltung'||hasAuthorizationArea(auth,area);
}
/** KORR-232 K3: the same target-area gate for task commands and their buttons. */
export function canCompleteTaskArea(auth:Parameters<typeof hasAuthorizationArea>[0],area:AccessArea){
 return hasAuthorizationArea(auth,area);
}

/** S05 VORAB 4: following up a quote is a mail operation, not money access. */
export function canReadQuoteFollowups(auth:Parameters<typeof hasAuthorizationArea>[0]){return hasAuthorizationArea(auth,'mails');}

/** Existing mailbox import authority, shared by source readers and the fetch composition. */
export function canSynchronizeIntakeMailbox(auth:Parameters<typeof hasAuthorizationArea>[0]){return hasAuthorizationArea(auth,"eingang")&&hasAuthorizationArea(auth,"mails");}
/** Existing search authority, shared by its server action and offline projection. */
export function canSearchTenant(auth:{permissions:readonly string[]}){return auth.permissions.includes('perm_view_leitstand');}
/** PL14Nov07:10: the manual order command has no mail purpose. */
export function canChangeOrderHandover(auth:Parameters<typeof hasAuthorizationArea>[0],source:'login'|'mail'){
 return hasAuthorizationArea(auth,'auftraege')&&(source==='login'||hasAuthorizationArea(auth,'mails'));
}



/**
 * The single server-side projection from effective areas to concrete product
 * actions. Commands and browser reads consume the same projection.
 */
export function getAuthorizationActionGrants(
  authorization: Parameters<typeof hasAuthorizationArea>[0],
): AuthorizationActionGrants {
  const canManageOrders = hasAuthorizationArea(authorization, "eingang");
  return {
    confirmPayment: hasAuthorizationArea(authorization, "zahlungen") || (
      hasAuthorizationArea(authorization, "kassieren")
      && hasAuthorizationArea(authorization, "auftraege")
    ),
    // PL2026-11-21 09:37: existing position correction is also an order task.
    editOrderContent: canManageOrders || hasAuthorizationArea(authorization, "auftraege"),
    createCustomer: hasAuthorizationArea(authorization, "eingang"),
    createQuote: canManageOrders && hasAuthorizationArea(authorization, "preise"),
  };
}

/** Cancellation acknowledgements contain no positions; payments can finish their existing command. */
export function canReadInvoiceCancellationProof(auth:Parameters<typeof hasAuthorizationArea>[0]&{permissions:readonly string[]}){return auth.permissions.includes('perm_view_prices')||hasAuthorizationArea(auth,'zahlungen');}
