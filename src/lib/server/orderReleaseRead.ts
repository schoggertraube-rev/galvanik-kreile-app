import 'server-only';
import {sql} from 'drizzle-orm';
import type {PrivilegedTenantTransaction} from './privilegedDb';

/** Existing complaint rows are the release block; no stored second flag. */
export async function readOpenOrderComplaint(tx:PrivilegedTenantTransaction,tenantId:string,orderId:string){
 const rows=await tx.execute<{id:string;number:string|null}>(sql`
  SELECT id,nummer AS number FROM public.complaints
  WHERE tenant_id=${tenantId} AND order_id=${orderId}
    AND stand IS DISTINCT FROM 'abgeschlossen'
  ORDER BY created_at,id LIMIT 1
 `);
 return rows[0]??null;
}
