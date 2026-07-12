import { db } from "@/db";
import { sql } from "drizzle-orm";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Setzt den Mandanten fuer eine DB-Transaktion fail-closed.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  if (typeof tenantId !== "string" || tenantId.trim().length === 0) {
    throw new Error("TENANT_ID_REQUIRED");
  }

  const normalizedTenantId = tenantId.trim();

  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${normalizedTenantId}, true)`);
    return fn(tx);
  });
}
