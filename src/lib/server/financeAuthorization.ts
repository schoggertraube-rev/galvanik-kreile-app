import { resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";

const FINANCE_PERMISSION = "perm_view_prices" as const;
const FIXED_TENANT_ID = "galvanik-kreile";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FINANCE_RANGE_DAYS = 366;

export async function requireFinanceRead(): Promise<AuthorizationSnapshot> {
  const auth = await resolveAuthorization();
  if (
    !auth.ok ||
    auth.data.tenantId !== FIXED_TENANT_ID ||
    !auth.data.permissions.includes(FINANCE_PERMISSION)
  ) {
    throw new Error("AUTH_ERROR: Forbidden");
  }

  return auth.data;
}

export async function requireFinanceAdmin(): Promise<AuthorizationSnapshot> {
  const actor = await requireFinanceRead();
  if (actor.role !== "admin" && actor.role !== "developer") {
    throw new Error("AUTH_ERROR: Forbidden");
  }
  return actor;
}

export async function requireFinanceWrite(): Promise<AuthorizationSnapshot> {
  const actor = await requireFinanceRead();
  if (actor.role !== "admin" && actor.role !== "developer" && actor.role !== "buero") {
    throw new Error("AUTH_ERROR: Forbidden");
  }
  return actor;
}

function parseIsoDate(value: string): number {
  if (!ISO_DATE.test(value)) {
    throw new Error("INVALID_DATE_RANGE");
  }

  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("INVALID_DATE_RANGE");
  }

  return timestamp;
}

export function assertFinanceDateRange(von: string, bis: string): void {
  const from = parseIsoDate(von);
  const to = parseIsoDate(bis);
  const days = Math.floor((to - from) / 86_400_000);
  if (days < 0 || days > MAX_FINANCE_RANGE_DAYS) {
    throw new Error("INVALID_DATE_RANGE");
  }
}
