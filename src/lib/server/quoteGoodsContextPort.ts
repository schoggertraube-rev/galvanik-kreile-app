import 'server-only';
import {sql} from 'drizzle-orm';
import type {AuthorizationSnapshot} from './authorization';
import type {PrivilegedTenantTransaction} from './privilegedDb';

export type QuoteGoodsContext={id:string;number:string;customerName:string;customerId:string;version:number;edition:number;linkedOrderId:string|null;accepted:boolean;declined:boolean;positions:Array<{id:string;position:number;quantity:number;name:string}>};
export async function readQuoteGoodsContext(tx:PrivilegedTenantTransaction,auth:Pick<AuthorizationSnapshot,'tenantId'>,quoteId:string):Promise<QuoteGoodsContext|null>{
 const locked=await tx.execute(sql`SELECT id FROM private.quotes WHERE tenant_id=${auth.tenantId} AND id=${quoteId}::uuid FOR UPDATE`);
 if(locked.length!==1)return null;
 const rows=await tx.execute<{quote_id:string;quote_number:string;customer_display_name:string;customer_id:string;version:number;fassung:number;linked_order_id:string|null;zugesagt_fassung:number|null;zugesagt_am:unknown;zusage_nachweis:string|null;abgesagt_am:unknown;positions:QuoteGoodsContext['positions'];integrity_ok:boolean}>(sql`SELECT quote_id,quote_number,customer_display_name,customer_id,version,fassung,linked_order_id,zugesagt_fassung,zugesagt_am,zusage_nachweis,abgesagt_am,positions,integrity_ok FROM private.v_quotes_v1 WHERE quote_id=${quoteId}::uuid`);
 if(rows.length!==1||!rows[0].integrity_ok)throw Error('QUOTE_GOODS_CONTEXT_INVALID');
 const row=rows[0];
 return {id:row.quote_id,number:row.quote_number,customerName:row.customer_display_name,customerId:row.customer_id,version:row.version,edition:row.fassung,linkedOrderId:row.linked_order_id,accepted:row.zugesagt_fassung===row.fassung&&Boolean(row.zugesagt_am)&&Boolean(row.zusage_nachweis?.trim())&&!row.abgesagt_am,declined:Boolean(row.abgesagt_am),positions:row.positions};
}

export type QuoteGoodsSummary={id:string;orderId:string|null;edition:number;location:string;blocked:boolean;version:number;packagesReceived?:number|null;packagesTotal?:number|null;condition?:string|null;deviations?:string[];clearance?:{reason:string;actorId:string;at:string}|null;expectedPositions:Array<{position:number;quantity:number}>};
const goodsSummaryProjection=sql`id::text,auftrag_id AS "orderId",kv_fassung AS edition,lagerort AS location,gesperrt AS blocked,version,packstuecke_da AS "packagesReceived",packstuecke_gesamt AS "packagesTotal",zustand AS condition,abweichung AS deviations,abweichung_geklaert AS clearance,(SELECT coalesce(jsonb_agg(jsonb_build_object('position',(line->>'kv_position')::integer,'quantity',(line->>'erwartet')::numeric)),'[]'::jsonb) FROM jsonb_array_elements(mengen) line WHERE (line->>'bestaetigt')::numeric=0) AS "expectedPositions"`;
export async function readQuoteGoodsSummaries(tx:PrivilegedTenantTransaction,tenantId:string,quoteId:string):Promise<QuoteGoodsSummary[]>{
 return [...await tx.execute<QuoteGoodsSummary>(sql`SELECT ${goodsSummaryProjection} FROM public.v_quote_goods_receipt_v1 WHERE tenant_id=${tenantId} AND kv_id=${quoteId}::uuid AND status<>'entwurf' AND rueckgabe IS NULL ORDER BY erstellt_am,id`)];
}

export async function readQuoteGoodsSummariesForQuotes(tx:PrivilegedTenantTransaction,tenantId:string,quoteIds:string[]){
 const grouped=new Map<string,QuoteGoodsSummary[]>();if(!quoteIds.length)return grouped;
 const rows=await tx.execute<QuoteGoodsSummary&{quoteId:string}>(sql`SELECT kv_id::text AS "quoteId",${goodsSummaryProjection} FROM public.v_quote_goods_receipt_v1 WHERE tenant_id=${tenantId} AND kv_id=ANY(ARRAY[${sql.join(quoteIds.map(id=>sql`${id}::uuid`),sql`, `)}]) AND status<>'entwurf' AND rueckgabe IS NULL ORDER BY erstellt_am,id`);
 for(const row of rows){const {quoteId,...summary}=row;const list=grouped.get(quoteId)??[];list.push(summary);grouped.set(quoteId,list);}return grouped;
}

export async function quoteHasCreatedOrder(tx:PrivilegedTenantTransaction,tenantId:string,quoteId:string,orderId:string){
 const rows=await tx.execute(sql`SELECT receipt.id FROM private.quote_conversion_receipts receipt JOIN private.quotes quote ON quote.tenant_id=receipt.tenant_id AND quote.id=receipt.quote_id AND quote.linked_order_id=receipt.order_id WHERE receipt.tenant_id=${tenantId} AND receipt.quote_id=${quoteId}::uuid AND receipt.order_id=${orderId}`);
 return rows.length===1;
}

export type QuoteFollowupFact={id:string;edition:number;stage:string;number:string;customerName:string;integrity:boolean};
export async function readQuoteFollowupFacts(tx:PrivilegedTenantTransaction,tenantId:string,ids:readonly string[]){
 if(!ids.length)return [];
 return [...await tx.execute<QuoteFollowupFact>(sql`SELECT quote_id::text AS id,fassung AS edition,derived_status AS stage,quote_number AS number,customer_display_name AS "customerName",integrity_ok AS integrity FROM private.v_quotes_v1 WHERE tenant_id=${tenantId} AND quote_id=ANY(ARRAY[${sql.join(ids.map(id=>sql`${id}`),sql`, `)}]::uuid[])`)];
}

/** Quantities belong to the existing received-goods record, not a second order draft. */
export async function readQuoteReceivedQuantities(tx:PrivilegedTenantTransaction,tenantId:string,quoteId:string,receiptId:string){
 const rows=await tx.execute<{id:string;mengen:Array<{kv_position:number;bestaetigt:number}>}>(sql`SELECT receipt.id::text,receipt.mengen FROM public.goods_receipt receipt
 WHERE receipt.tenant_id=${tenantId} AND receipt.kv_id=${quoteId}::uuid AND receipt.status='angenommen'
 AND NOT EXISTS(SELECT 1 FROM public.intake_event returned WHERE returned.tenant_id=receipt.tenant_id AND returned.art='ware' AND returned.nachher->>'action'='kv.ware_zurueckgegeben' AND returned.nachher->>'receiptId'=receipt.id::text)
 ORDER BY receipt.id FOR SHARE OF receipt`);
 if(!rows.length)return null;
 const totals=new Map<number,number>();
 for(const row of rows)for(const line of row.mengen){if(!Number.isSafeInteger(line.kv_position)||line.kv_position<1||!Number.isSafeInteger(line.bestaetigt)||line.bestaetigt<0)throw Error('QUOTE_GOODS_BUNDLE_INVALID');const sum=(totals.get(line.kv_position)??0)+line.bestaetigt;if(!Number.isSafeInteger(sum))throw Error('QUOTE_GOODS_BUNDLE_OVERFLOW');totals.set(line.kv_position,sum);}
 // The selected ID is validated against the quote projection by the caller.
 void receiptId;
 return [...totals].sort(([a],[b])=>a-b).map(([kv_position,bestaetigt])=>({kv_position,bestaetigt}));
}

/** A closed authorization case for the existing order writer, backed by its canonical KV reservation. */
export async function hasReservedQuoteOrderIntent(tx:PrivilegedTenantTransaction,actor:{tenantId:string;userId:string},input:{quoteId:string;customerId:string;clientEventId:string;orderIntentSha256:string}){
 const rows=await tx.execute(sql`SELECT request.quote_id FROM private.quote_conversion_requests request JOIN private.quotes quote ON quote.tenant_id=request.tenant_id AND quote.id=request.quote_id
 WHERE request.tenant_id=${actor.tenantId} AND request.quote_id=${input.quoteId}::uuid AND request.actor_id=${actor.userId}::uuid AND request.client_event_id=${input.clientEventId}::uuid AND request.order_intent_sha256=${input.orderIntentSha256}
 AND quote.customer_id=${input.customerId} AND quote.zugesagt_fassung=quote.fassung AND quote.zugesagt_am IS NOT NULL AND nullif(btrim(quote.zusage_nachweis),'') IS NOT NULL AND quote.abgesagt_am IS NULL
 AND (quote.linked_order_id IS NULL OR EXISTS(SELECT 1 FROM private.quote_conversion_receipts receipt WHERE receipt.tenant_id=request.tenant_id AND receipt.quote_id=request.quote_id AND receipt.actor_id=request.actor_id AND receipt.client_event_id=request.client_event_id AND receipt.order_id=quote.linked_order_id))`);
 return rows.length===1;
}
