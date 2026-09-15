export type AppRole = "developer" | "admin" | "meister" | "buero" | "werkstatt" | "readonly";

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
  | "perm_view_leitstand"
  | "perm_view_customers"
  | "perm_view_prices";

/** Product labels are separate from the authenticated actor and role contract. */
export type ProductIdentity = {
  name: "Rolf" | "Phillip" | "Gregor";
  responsibility: "Meister" | "Werkstatt" | "Systemadministrator";
  initials: "R" | "P" | "G";
};

export const ROLE_LABELS: Record<AppRole, string> = {
  developer: "Entwickler",
  admin: "Administrator",
  meister: "Meister",
  buero: "Büro",
  werkstatt: "Werkstatt",
  readonly: "Nur Leserechte",
};

export const ROLE_PERMISSIONS: Record<AppRole, readonly PermissionKey[]> = {
  developer: [
    "perm_sys_toggles",
    "perm_sys_diag",
    "perm_sys_users",
    "perm_data_csv",
    "perm_data_customers",
    "perm_data_orders",
    "perm_op_status",
    "perm_op_risk",
    "perm_op_photos",
    "perm_op_qa",
    "perm_view_leitstand",
    "perm_view_customers",
    "perm_view_prices",
  ],
  admin: [
    "perm_sys_diag",
    "perm_sys_users",
    "perm_data_csv",
    "perm_data_customers",
    "perm_data_orders",
    "perm_op_status",
    "perm_op_risk",
    "perm_op_photos",
    "perm_op_qa",
    "perm_view_leitstand",
    "perm_view_customers",
    "perm_view_prices",
  ],
  meister: [
    "perm_data_customers",
    "perm_data_orders",
    "perm_op_status",
    "perm_op_risk",
    "perm_op_photos",
    "perm_op_qa",
    "perm_view_leitstand",
    "perm_view_customers",
  ],
  buero: [
    "perm_data_customers",
    "perm_data_orders",
    "perm_view_leitstand",
    "perm_view_customers",
    "perm_view_prices",
  ],
  werkstatt: [
    "perm_op_status",
    "perm_op_photos",
    "perm_view_leitstand",
    "perm_view_customers",
  ],
  readonly: [
    "perm_view_leitstand",
    "perm_view_customers",
  ],
};

export function isAppRole(value: unknown): value is AppRole {
  if (typeof value !== "string") return false;
  return value in ROLE_PERMISSIONS;
}

export function getRoleLabel(role: AppRole): string {
  return ROLE_LABELS[role] || role;
}

export function getPermissionsForRole(role: AppRole): readonly PermissionKey[] {
  return ROLE_PERMISSIONS[role] || [];
}

type ProductIdentityKey = "rolf" | "phillip" | "gregor";

const PRODUCT_IDENTITIES: Record<ProductIdentityKey, ProductIdentity> = {
  rolf: { name: "Rolf", responsibility: "Meister", initials: "R" },
  phillip: { name: "Phillip", responsibility: "Werkstatt", initials: "P" },
  gregor: { name: "Gregor", responsibility: "Systemadministrator", initials: "G" },
};

/**
 * Non-secret server configuration. A product label is never derived from a
 * technical role: it belongs only to the configured, individual app-user.
 */
function configuredProductActors(): Record<ProductIdentityKey, string | null> | null {
  const actors = {
    rolf: process.env.KREILE_ROLF_APP_USER_ID?.trim() || null,
    phillip: process.env.KREILE_PHILLIP_APP_USER_ID?.trim() || null,
    gregor: process.env.KREILE_GREGOR_APP_USER_ID?.trim() || null,
  } as const;
  const configured = Object.values(actors).filter((value): value is string => value !== null);
  if (configured.length === 0 || new Set(configured).size !== configured.length) return null;
  return actors;
}

/**
 * Resolves a visible product identity from one exact configured AppUser ID.
 * Missing, duplicate or unrelated IDs deliberately have no product identity.
 */
export function getProductIdentity(actorId: string): ProductIdentity | null {
  if (!actorId) return null;
  const actors = configuredProductActors();
  if (!actors) return null;
  const key = (Object.keys(actors) as ProductIdentityKey[]).find((candidate) => actors[candidate] === actorId);
  return key ? PRODUCT_IDENTITIES[key] : null;
}
