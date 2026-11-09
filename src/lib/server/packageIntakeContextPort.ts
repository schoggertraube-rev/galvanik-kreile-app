import {packagePartWords} from '@/lib/domain/packagePartWords';
export {packagePartWords} from '@/lib/domain/packagePartWords';
import 'server-only';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import type {PrivilegedTenantTransaction} from './privilegedDb';

/** Read-only operational history. No inference is ever saved as a customer assignment. */
export type PackageCustomerHistory={customerId:string;customerName:string;lastAt:string;source:'order'|'quote'};
export async function readPackageOrderCustomers(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,text:string):Promise<PackageCustomerHistory[]>{
 if(!hasAuthorizationArea(auth,'eingang')||!hasAuthorizationArea(auth,'kunden')||!hasAuthorizationArea(auth,'auftraege'))return [];
 const words=packagePartWords(text);if(!words.length)return [];
 const rows=await tx.execute<{customerId:string;customerName:string;lastAt:string}>(sql`SELECT customer.id AS "customerId",customer.name AS "customerName",max(orders.created_at)::text AS "lastAt"
 FROM public.orders orders JOIN public.items item ON item.tenant_id=orders.tenant_id AND item.order_id=orders.id
 JOIN public.customers customer ON customer.tenant_id=orders.tenant_id AND customer.id=orders.customer_id
 WHERE orders.tenant_id=${auth.tenantId} AND orders.status<>'storniert'
 AND regexp_split_to_array(lower(item.name),'[^[:alnum:]]+') && ARRAY[${sql.join(words.map(word=>sql`${word}`),sql`, `)}]::text[]
 GROUP BY customer.id,customer.name ORDER BY max(orders.created_at) DESC,customer.id LIMIT 3`);
 return rows.map(row=>({...row,source:'order' as const}));
}

/** Same stored goods expectation, excluding withdrawn orders before limiting the candidate list. */
export async function readExpectedPackageOrders(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,customerId:string|null){
 if(!hasAuthorizationArea(auth,'auftraege'))return [];
 const rows=await tx.execute<{id:string;number:string;customerId:string;customerName:string|null;title:string|null;since:string|null;reason:'rework'|'waiting'}>(sql`SELECT orders.id,orders.order_number AS number,orders.customer_id AS "customerId",customer.name AS "customerName",orders.task AS title,orders.ware_seit::text AS since,
 CASE WHEN orders.source='REKLAMATION_NACHARBEIT' THEN 'rework' ELSE 'waiting' END AS reason
 FROM public.orders orders LEFT JOIN public.customers customer ON customer.tenant_id=orders.tenant_id AND customer.id=orders.customer_id
 WHERE orders.tenant_id=${auth.tenantId} AND orders.ware IN ('erwartet','teilweise') AND orders.status<>'storniert'
 ORDER BY (orders.customer_id=${customerId}) DESC NULLS LAST,orders.ware_seit ASC NULLS LAST,orders.id LIMIT 8`);
 return [...rows];
}
