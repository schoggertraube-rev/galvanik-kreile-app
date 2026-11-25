import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";

type TenantAuthorization = Pick<AuthorizationSnapshot, "tenantId">;
const taktStatementTimeout = new AsyncLocalStorage<number>();

/** Limits every tenant transaction entered while one reserved Takt job runs. */
export function withTaktStatementTimeout<T>(milliseconds: number, work: () => Promise<T>): Promise<T> {
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 1 || milliseconds > 50_000) throw Error('TAKT_STATEMENT_TIMEOUT_INVALID');
  return taktStatementTimeout.run(milliseconds, work);
}

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
    await transaction.execute(sql`SELECT set_config('app.tenant_id', ${authorization.tenantId}, true)`);
    const timeout = taktStatementTimeout.getStore();
    if (timeout !== undefined) await transaction.execute(sql`SELECT set_config('statement_timeout', ${String(timeout) + 'ms'}, true)`);
    return work(transaction as PrivilegedTenantTransaction);
  });
}

/** Keep SQL failures inside the driver's nested transaction/savepoint scope.
 * A raw SAVEPOINT does not clear postgres-js's outer transaction error state. */
export async function withTenantSavepoint<T>(tx:PrivilegedTenantTransaction,work:(nested:PrivilegedTenantTransaction)=>Promise<T>):Promise<T>{
 const transaction=tx as Parameters<Parameters<typeof db.transaction>[0]>[0];
 return transaction.transaction(nested=>work(nested as PrivilegedTenantTransaction));
}
