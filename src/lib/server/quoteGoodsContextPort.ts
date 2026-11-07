import 'server-only';
import {sql} from 'drizzle-orm';
import type {AuthorizationSnapshot} from './authorization';
import type {PrivilegedTenantTransaction} from './privilegedDb';

export type QuoteGoodsContext={id:string;customerId:string;version:number;edition:number;linkedOrderId:string|null;accepted:boolean;declined:boolean;positions:Array<{id:string;position:number;quantity:number;name:string}>};
export async function readQuoteGoodsContext(tx:PrivilegedTenantTransaction,auth:Pick<AuthorizationSnapshot,'tenantId'>,quoteId:string):Promise<QuoteGoodsContext|null>{
 const locked=await tx.execute(sql`SELECT id FROM private.quotes WHERE tenant_id=${auth.tenantId} AND id=${quoteId}::uuid FOR UPDATE`);
 if(locked.length!==1)return null;
 const rows=await tx.execute<{quote_id:string;customer_id:string;version:number;fassung:number;linked_order_id:string|null;zugesagt_fassung:number|null;zugesagt_am:unknown;zusage_nachweis:string|null;abgesagt_am:unknown;positions:QuoteGoodsContext['positions'];integrity_ok:boolean}>(sql`SELECT quote_id,customer_id,version,fassung,linked_order_id,zugesagt_fassung,zugesagt_am,zusage_nachweis,abgesagt_am,positions,integrity_ok FROM private.v_quotes_v1 WHERE quote_id=${quoteId}::uuid`);
 if(rows.length!==1||!rows[0].integrity_ok)throw Error('QUOTE_GOODS_CONTEXT_INVALID');
 const row=rows[0];
 return {id:row.quote_id,customerId:row.customer_id,version:row.version,edition:row.fassung,linkedOrderId:row.linked_order_id,accepted:row.zugesagt_fassung===row.fassung&&Boolean(row.zugesagt_am)&&Boolean(row.zusage_nachweis?.trim())&&!row.abgesagt_am,declined:Boolean(row.abgesagt_am),positions:row.positions};
}

export type QuoteGoodsSummary={id:string;orderId:string|null;edition:number;location:string;blocked:boolean;version:number};
export async function readQuoteGoodsSummaries(tx:PrivilegedTenantTransaction,tenantId:string,quoteId:string):Promise<QuoteGoodsSummary[]>{
 return [...await tx.execute<QuoteGoodsSummary>(sql`SELECT id::text,auftrag_id AS "orderId",kv_fassung AS edition,lagerort AS location,gesperrt AS blocked,version FROM public.v_quote_goods_receipt_v1 WHERE tenant_id=${tenantId} AND kv_id=${quoteId}::uuid AND status<>'entwurf' ORDER BY erstellt_am,id`)];
}

export async function quoteHasCreatedOrder(tx:PrivilegedTenantTransaction,tenantId:string,quoteId:string,orderId:string){
 const rows=await tx.execute(sql`SELECT receipt.id FROM private.quote_conversion_receipts receipt JOIN private.quotes quote ON quote.tenant_id=receipt.tenant_id AND quote.id=receipt.quote_id AND quote.linked_order_id=receipt.order_id WHERE receipt.tenant_id=${tenantId} AND receipt.quote_id=${quoteId}::uuid AND receipt.order_id=${orderId}`);
 return rows.length===1;
}
