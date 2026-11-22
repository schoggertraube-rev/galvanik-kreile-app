import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import {actionObservationActive,observeTenantTransaction} from './actionObservation';

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
  const observed=actionObservationActive();
  const result=await db.transaction(async (transaction) => {
    await transaction.execute(
      observed
        ? sql`SELECT set_config('app.tenant_id', ${authorization.tenantId}, true),set_config('app.today_source_changed','',true)`
        : sql`SELECT set_config('app.tenant_id', ${authorization.tenantId}, true)`,
    );
    const value=await work(transaction as PrivilegedTenantTransaction);
    if(!observed)return {value,sourceChanged:false};
    const flags=await transaction.execute<{changed:boolean}>(sql`SELECT current_setting('app.today_source_changed',true)='1' AS changed`);
    if(flags.length!==1)throw Error('TODAY_SOURCE_OBSERVATION_UNAVAILABLE');
    return {value,sourceChanged:flags[0].changed===true};
  });
  // Publish observation only after the driver has confirmed COMMIT. The flag
  // is transaction-local and obeys the native nested savepoint rollback.
  if(result.sourceChanged)observeTenantTransaction(authorization.tenantId);
  return result.value;
}

/** Keep SQL failures inside the driver's nested transaction/savepoint scope.
 * A raw SAVEPOINT does not clear postgres-js's outer transaction error state. */
export async function withTenantSavepoint<T>(tx:PrivilegedTenantTransaction,work:(nested:PrivilegedTenantTransaction)=>Promise<T>):Promise<T>{
 const transaction=tx as Parameters<Parameters<typeof db.transaction>[0]>[0];
 return transaction.transaction(nested=>work(nested as PrivilegedTenantTransaction));
}
