import type { PermissionKey } from "@/lib/auth/authorizationContract";
import type { AppRole } from "@/lib/auth/authorizationContract";
import { resolveAuthorization } from "@/lib/server/authorization";

export type FinanceDataScope = {
  userId: string;
  tenantId: string;
  role: AppRole;
  canViewFinance: boolean;
  canViewQuality: boolean;
};

export type FinanceDataScopeResult =
  | { ok: true; data: FinanceDataScope }
  | {
      ok: false;
      error: "UNAUTHORIZED" | "FORBIDDEN" | "DB_ERROR";
      message: string;
    };

export async function resolveFinanceDataScope(
  requiredAnyPermission: readonly PermissionKey[],
): Promise<FinanceDataScopeResult> {
  const authorization = await resolveAuthorization();

  if (!authorization.ok) {
    return {
      ok: false,
      error:
        authorization.reason === "AUTHORIZATION_UNAVAILABLE"
          ? "DB_ERROR"
          : "UNAUTHORIZED",
      message: authorization.message,
    };
  }

  const permitted = requiredAnyPermission.some((permission) =>
    authorization.data.permissions.includes(permission),
  );

  if (!permitted) {
    return {
      ok: false,
      error: "FORBIDDEN",
      message: "Keine Berechtigung für diese Daten.",
    };
  }

  return {
    ok: true,
    data: {
      userId: authorization.data.userId,
      tenantId: authorization.data.tenantId,
      role: authorization.data.role,
      canViewFinance: authorization.data.permissions.includes("perm_view_prices"),
      canViewQuality: authorization.data.permissions.includes("perm_op_qa"),
    },
  };
}
