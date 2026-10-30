type AccountingAuthorization = {
  permissions: readonly string[];
};

export function canViewAccounting(authorization: AccountingAuthorization): boolean {
  return authorization.permissions.includes("perm_view_prices");
}
