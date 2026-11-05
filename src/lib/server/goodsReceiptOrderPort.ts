import "server-only";
import {createHash} from "node:crypto";
import {sql} from "drizzle-orm";
import type {PrivilegedTenantTransaction} from "./privilegedDb";
import type {AuthorizationSnapshot} from "./authorization";
import type {GoodsReceiptOrderRead} from "@/modules/eingang/public";
type Actor=Pick<AuthorizationSnapshot,"tenantId"|"userId">;
// UUIDv5 namespace keeps the goods receipt event separate from the existing station command.
function goodsEventKey(requestKey:string){const bytes=createHash('sha1').update(Buffer.from('18ecc293b0fb5e4ca02c862be30b3917','hex')).update(requestKey,'utf8').digest();bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const hex=bytes.subarray(0,16).toString('hex');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
export type GoodsReceiptOrder=GoodsReceiptOrderRead;
export async function readGoodsReceiptOrder(tx:PrivilegedTenantTransaction,auth:Actor,orderId:string):Promise<GoodsReceiptOrder|null>{
 const rows=await tx.execute<Omit<GoodsReceiptOrder,"items">>(sql`SELECT orders.id,orders.order_number AS number,orders.title,orders.task AS note,orders.customer_id AS "customerId",customer.name AS "customerName",orders.version,orders.station,orders.status,orders.ware,
  EXISTS(SELECT 1 FROM private.v_quote_conversion_receipts_v1 quote WHERE quote.tenant_id=orders.tenant_id AND quote.order_id=orders.id) AS "fromQuote"
  FROM public.orders orders JOIN public.customers customer ON customer.tenant_id=orders.tenant_id AND customer.id=orders.customer_id WHERE orders.tenant_id=${auth.tenantId} AND orders.id=${orderId} FOR UPDATE OF orders`);
 if(rows.length!==1)return null;
 const items=await tx.execute<GoodsReceiptOrder["items"][number]>(sql`SELECT id,name,quantity::float8 AS quantity,unit,surface_requested AS surface,internal_notes AS note FROM public.items WHERE tenant_id=${auth.tenantId} AND order_id=${orderId} ORDER BY created_at,id FOR SHARE`);
 return {...rows[0],items};
}
export async function updateGoodsReceiptOrder(tx:PrivilegedTenantTransaction,auth:Actor,order:GoodsReceiptOrder,ware:string,aggregateMode:"increment"|"station"|"creation"){
 const version=aggregateMode==='station'?order.version+1:order.version;
 const rows=await tx.execute<{version:number}>(sql`UPDATE public.orders SET ware=${ware},ware_seit=statement_timestamp(),version=version+${aggregateMode==='increment'?1:0}
  WHERE tenant_id=${auth.tenantId} AND id=${order.id} AND version=${version} RETURNING version`);
 if(rows.length!==1)throw Error('GOODS_RECEIPT_ORDER_VERSION_CONFLICT');return rows[0].version;
}
export async function readGoodsReceiptEvent(tx:PrivilegedTenantTransaction,auth:Actor,clientEventId:string){
 return tx.execute<{payload:Record<string,unknown>;user_id:string}>(sql`SELECT payload,user_id::text FROM public.events
  WHERE tenant_id=${auth.tenantId} AND client_event_id=${goodsEventKey(clientEventId)}::uuid AND event_type='GOODS_RECEIPT_SAVED_V1'`);
}
export async function appendGoodsReceiptEvent(tx:PrivilegedTenantTransaction,auth:Actor,input:{clientEventId:string;orderId:string;receiptId:string;version:number;intent:string;before:unknown;after:unknown}){
 await tx.execute(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,aggregate_version,correlation_id)
  VALUES(gen_random_uuid()::text,${auth.tenantId},${input.orderId},'GOODS_RECEIPT_SAVED_V1','Warenprüfung gespeichert',
   ${JSON.stringify({requestKey:input.clientEventId,receiptId:input.receiptId,intent:input.intent,before:input.before,after:input.after})}::jsonb,'success',${auth.userId}::uuid,${goodsEventKey(input.clientEventId)}::uuid,1,${input.version},gen_random_uuid())`);
}
