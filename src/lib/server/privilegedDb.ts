import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";

type TenantAuthorization = Pick<AuthorizationSnapshot, "tenantId">;

export type PrivilegedTenantTransaction = Pick<typeof db, "execute" | "select" | "update">;

/**
 * The only direct database transaction port for W3 commands. The tenant is
 * installed transaction-locally before command work starts; commands still
 * must include tenant predicates on every relation they touch.
 */
export async function withPrivilegedTenantTransaction<T>(
  authorization: TenantAuthorization,
  work: (tx: PrivilegedTenantTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SELECT set_config('app.tenant_id', ${authorization.tenantId}, true)`,
    );
    return work(transaction as PrivilegedTenantTransaction);
  });
}
