import 'server-only';
import {sql} from 'drizzle-orm';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';

/** S38a E1/B5: our customer terms, never the supplier's zahlungsziel_tage. */
export async function readCustomerInvoiceTerms(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string){
 const rows=await tx.execute<{
  id:string;enabled:boolean;targetDays:number|null;discountPercent:string|number|null;discountDays:number|null;
 }>(sql`SELECT id,ziel_freigeschaltet AS enabled,ziel_tage AS "targetDays",
   skonto_prozent AS "discountPercent",skonto_tage AS "discountDays"
   FROM public.customers WHERE tenant_id=${tenantId} AND id=${customerId} FOR SHARE`);
 if(rows.length!==1||rows[0].id!==customerId)throw Error('INVOICE_CUSTOMER_TERMS_SOURCE_MISSING');
 return rows[0];
}
