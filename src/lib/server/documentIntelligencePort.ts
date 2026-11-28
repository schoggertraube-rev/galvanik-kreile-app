import "server-only";

import { sql } from "drizzle-orm";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

/** Reads the storage reference of a secured historical original. New originals use intake_file. */
export async function readSecuredDomainAttachmentSource(tx: PrivilegedTenantTransaction, tenantId: string, attachmentId: string) {
  const rows = await tx.execute<{ id: string; file_type: string | null; original_storage_path: string | null }>(sql`
    SELECT id, file_type, original_storage_path
    FROM public.scan_uploads
    WHERE tenant_id = ${tenantId} AND id = ${attachmentId} AND status = 'secured'
    LIMIT 2
  `);
  if (rows.length > 1) throw new Error("DOMAIN_ATTACHMENT_AMBIGUOUS");
  return rows[0] ?? null;
}
