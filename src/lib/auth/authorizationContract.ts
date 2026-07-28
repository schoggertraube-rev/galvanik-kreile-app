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

/** Developers use the administrative identity flow and must never appear on the
 * anonymous PIN selector screen. */
export function canUsePinLoginRole(role: AppRole): boolean {
  return role !== "developer";
}
