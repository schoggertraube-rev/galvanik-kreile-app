import 'server-only';
import {sql} from 'drizzle-orm';
import {packagePartWords} from '@/lib/domain/packagePartWords';
import {hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';

export async function readPackageOrderCustomers(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,text:string):Promise<Array<{customerId:string;lastAt:string}>>{
 if(!hasAuthorizationArea(auth,'eingang')||!hasAuthorizationArea(auth,'kunden')||!hasAuthorizationArea(auth,'auftraege'))return [];
 const words=packagePartWords(text);if(!words.length)return [];
 const rows=await tx.execute<{customerId:string;lastAt:string}>(sql`SELECT orders.customer_id AS "customerId",max(orders.created_at)::text AS "lastAt"
 FROM public.orders orders JOIN public.items item ON item.tenant_id=orders.tenant_id AND item.order_id=orders.id
 WHERE orders.tenant_id=${auth.tenantId} AND orders.status<>'storniert'
 AND regexp_split_to_array(lower(item.name),'[^[:alnum:]]+') && ARRAY[${sql.join(words.map(word=>sql`${word}`),sql`, `)}]::text[]
 GROUP BY orders.customer_id ORDER BY max(orders.created_at) DESC,orders.customer_id LIMIT 3`);
 return [...rows];
}
