import 'server-only';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,type AuthorizationSnapshot} from './authorization';
import type {PrivilegedTenantTransaction} from './privilegedDb';

/** Read-only operational history. No inference is ever saved as a customer assignment. */
export function packagePartWords(text:string){
 const ignored=new Set(['paket','ware','absender','unbekannt','bitte','stück','stueck','verchromen','verzinken','vernickeln','lieferschein','inhalt','diese','dieser','ohne','steht','zurück','zurueck','versand']);
 return [...new Set(text.toLocaleLowerCase('de-DE').split(/[^\p{L}\p{N}]+/u).filter(word=>word.length>=4&&!ignored.has(word)))].slice(0,8);
}
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
