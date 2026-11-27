import "server-only";

import { sql } from "drizzle-orm";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

export async function hatArbeitszeitAuftragInTransaction(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  auftragId: string,
  itemId: string | null,
) {
  const [row] = await tx.execute<{ vorhanden: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM public.orders auftrag
      WHERE auftrag.tenant_id = ${tenantId} AND auftrag.id = ${auftragId}
        AND (${itemId}::text IS NULL OR EXISTS (
          SELECT 1 FROM public.items teil
          WHERE teil.tenant_id = auftrag.tenant_id AND teil.order_id = auftrag.id
            AND teil.id = ${itemId}::text
        ))
    ) AS vorhanden
  `);
  return row?.vorhanden === true;
}
