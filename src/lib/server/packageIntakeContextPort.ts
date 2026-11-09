export {packagePartWords} from '@/lib/domain/packagePartWords';
import 'server-only';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import type {PrivilegedTenantTransaction} from './privilegedDb';

/** Read-only operational history. No inference is ever saved as a customer assignment. */
export type PackageCustomerHistory={customerId:string;customerName:string;lastAt:string;source:'order'|'quote'};

/** Same stored goods expectation, excluding withdrawn orders before limiting the candidate list. */
export async function readExpectedPackageOrders(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,customerId:string|null){
 if(!hasAuthorizationArea(auth,'auftraege'))return [];
 const rows=await tx.execute<{id:string;number:string;customerId:string;customerName:string|null;title:string|null;since:string|null;reason:'rework'|'waiting'}>(sql`SELECT id,order_number AS number,customer_id AS "customerId",customer_name AS "customerName",title,ware_seit::text AS since,reason
 FROM public.v_intake_expected_goods_v1 WHERE tenant_id=${auth.tenantId} AND storniert=false
 ORDER BY (customer_id=${customerId}) DESC NULLS LAST,ware_seit ASC NULLS LAST,id LIMIT 8`);
 return [...rows];
}
