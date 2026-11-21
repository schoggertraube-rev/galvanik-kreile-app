import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {scaleQuotePositions} from '@/modules/quotes/public';
import type {QuoteCalculation,QuoteQuantityLine} from '@/modules/quotes/public';
import type {PrivilegedTenantTransaction} from './privilegedDb';
import type {AuthorizationSnapshot} from './authorization';

export type OrderCommercialQuote={shippingIncluded:boolean;quoteId:string;quoteNumber:string;edition:number;totalNetCents:number;plannedHours:string|null;specialRequests:string|null;vatRateBasisPoints?:0|700|1900|null;legacyMinutesAllocated?:boolean;positions:Array<{itemId:string;position:number;name:string;quantity:number;lineTotalCents:number;unit?:string|null;plannedMinutes?:number|null;vatRateBasisPoints?:0|700|1900|null}>};
/** Immutable awarded quote is the sole source of its agreed line totals, never a rounded unit-price copy. */
type CommercialQuoteSource=OrderCommercialQuote&{sourceOrderId:string;integrity:boolean;sourceCalculation:QuoteCalculation|null;sourcePositions:Array<QuoteQuantityLine&{vatRateBasisPoints:0|700|1900|null}>};
type PreparedCommercialQuote={quote:OrderCommercialQuote;sourcePositions:CommercialQuoteSource['sourcePositions'];scaled:Extract<ReturnType<typeof scaleQuotePositions>,{code:'OK'}>};
export async function readOrderCommercialQuote(tx:PrivilegedTenantTransaction,tenantId:string,orderId:string):Promise<OrderCommercialQuote>{
 const quotes=await readOrderCommercialQuotes(tx,tenantId,[orderId]),quote=quotes.get(orderId);
 if(quote instanceof Error)throw quote;
 if(quote===undefined)throw Error('ORDER_CARD_QUOTE_PRICE_INVALID');return quote;
}
/** One immutable awarded source and VAT fallback query; validation remains per order. */
export async function readOrderCommercialQuotes(tx:PrivilegedTenantTransaction,tenantId:string,orderIds:readonly string[]):Promise<Map<string,OrderCommercialQuote|Error>>{
 const ids=[...new Set(orderIds)],result=new Map<string,OrderCommercialQuote|Error>(),prepared=new Map<string,PreparedCommercialQuote>();
 if(!ids.length)return result;
 const sourceRows=await tx.execute<CommercialQuoteSource>(sql`SELECT receipt.order_id AS "sourceOrderId",quote.id::text AS "quoteId",quote.quote_number AS "quoteNumber",quote.fassung AS edition,sum(round(coalesce(position.zeilen_gesamt_cents,position.line_total_cents)::numeric * (item.value->>'quantity')::numeric / position.quantity))::float8 AS "totalNetCents",quote.sonderwuensche AS "specialRequests",quote.versand_enthalten AS "shippingIncluded",
  CASE WHEN quote.kalk_stunden IS NOT NULL THEN jsonb_build_object('hours',quote.kalk_stunden::text,'hourlyRateCents',quote.stundensatz_cents,'setupCents',quote.ruest_cents,'materialCents',quote.material_cents) ELSE NULL END AS "sourceCalculation",(SELECT jsonb_agg(jsonb_build_object('position',original.position,'quantity',original.quantity,'unit',original.unit,'plannedMinutes',original.aufwand_min,'vatRateBasisPoints',original.vat_rate_basis_points,'lineTotalCents',coalesce(original.zeilen_gesamt_cents,original.line_total_cents)) ORDER BY original.position) FROM private.quote_positions original WHERE original.tenant_id=quote.tenant_id AND original.quote_id=quote.id AND original.revision=quote.version) AS "sourcePositions",
  CASE WHEN count(*)=(SELECT count(*) FROM private.quote_positions original WHERE original.tenant_id=quote.tenant_id AND original.quote_id=quote.id AND original.revision=quote.version) AND min((item.value->>'quantity')::numeric/position.quantity)=max((item.value->>'quantity')::numeric/position.quantity) THEN round(quote.kalk_stunden*min((item.value->>'quantity')::numeric/position.quantity),4)::text ELSE NULL END AS "plannedHours",
  jsonb_agg(jsonb_build_object('itemId',item.value->>'id','position',position.position,'name',position.name,'quantity',(item.value->>'quantity')::numeric,'lineTotalCents',round(coalesce(position.zeilen_gesamt_cents,position.line_total_cents)::numeric * (item.value->>'quantity')::numeric / position.quantity)) ORDER BY position.position) AS positions,
  bool_and(position.quantity>0 AND (item.value->>'quantity')::numeric>0 AND trunc((item.value->>'quantity')::numeric)=(item.value->>'quantity')::numeric) AND (SELECT sum(coalesce(original.zeilen_gesamt_cents,original.line_total_cents)) FROM private.quote_positions original WHERE original.tenant_id=quote.tenant_id AND original.quote_id=quote.id AND original.revision=quote.version)=quote.total_net_cents AS integrity
  FROM private.quote_conversion_receipts receipt JOIN private.quotes quote ON quote.tenant_id=receipt.tenant_id AND quote.id=receipt.quote_id AND quote.linked_order_id=receipt.order_id AND quote.version=receipt.quote_version
  JOIN private.order_intake_receipts intake ON intake.tenant_id=receipt.tenant_id AND intake.event_id=receipt.order_intake_event_id AND intake.order_id=receipt.order_id
  CROSS JOIN LATERAL jsonb_array_elements(intake.items_snapshot) WITH ORDINALITY item(value,ordinal)
  JOIN public.goods_receipt goods ON goods.tenant_id=receipt.tenant_id AND goods.kv_id=quote.id AND goods.auftrag_id=receipt.order_id
  CROSS JOIN LATERAL jsonb_array_elements(goods.mengen) received(value)
  JOIN private.quote_positions position ON position.tenant_id=quote.tenant_id AND position.quote_id=quote.id AND position.revision=receipt.quote_version AND position.position=(received.value->>'kv_position')::integer AND received.value->>'teil_id'=item.value->>'id' AND (received.value->>'bestaetigt')::numeric>0
  WHERE receipt.tenant_id=${tenantId} AND receipt.order_id=ANY(ARRAY[${sql.join(ids.map(id=>sql`${id}`),sql`, `)}]::text[]) GROUP BY receipt.order_id, quote.id,quote.quote_number,quote.fassung,quote.total_net_cents,quote.sonderwuensche`);
 if(sourceRows.some(row=>!ids.includes(row.sourceOrderId)))throw Error('ORDER_CARD_QUOTE_PRICE_INVALID');
 for(const orderId of ids){
  try{
   const rows=sourceRows.filter(row=>row.sourceOrderId===orderId).map(({sourceOrderId,...row})=>{void sourceOrderId;return row;});
 if(rows.length!==1||!rows[0].integrity||typeof rows[0].shippingIncluded!=='boolean')throw Error('ORDER_CARD_QUOTE_PRICE_INVALID');
 const {integrity:_integrity,sourceCalculation,sourcePositions,...quote}=rows[0];void _integrity;
 if(!Number.isSafeInteger(quote.totalNetCents)||quote.totalNetCents<0||!Array.isArray(quote.positions)||!quote.positions.length||quote.positions.some(row=>typeof row.itemId!=='string'||!Number.isSafeInteger(row.lineTotalCents)||row.lineTotalCents<0)||quote.positions.reduce((total,row)=>total+row.lineTotalCents,0)!==quote.totalNetCents)throw Error('ORDER_CARD_QUOTE_PRICE_INVALID');
  const scaled=scaleQuotePositions(sourceCalculation,sourcePositions,sourcePositions.map(row=>({position:row.position,quantity:quote.positions.find(received=>received.position===row.position)?.quantity??0})));
  if(scaled.code!=='OK')throw Error('ORDER_CARD_QUOTE_CALCULATION_INVALID');

   prepared.set(orderId,{quote,sourcePositions,scaled});
  }catch(error){result.set(orderId,error instanceof Error?error:new Error('ORDER_CARD_QUOTE_PRICE_INVALID',{cause:error}));}
 }
 if(!prepared.size)return result;
 const requests=[...prepared.entries()];
 const vatRows=await tx.execute<{sourceOrderId:string;rate:0|700|1900}>(sql`SELECT requested.order_id AS "sourceOrderId",source.rate
  FROM unnest(ARRAY[${sql.join(requests.map(([id])=>sql`${id}`),sql`, `)}]::text[],ARRAY[${sql.join(requests.map(([,value])=>sql`${value.quote.quoteId}`),sql`, `)}]::text[],ARRAY[${sql.join(requests.map(([,value])=>sql`${value.quote.edition}`),sql`, `)}]::integer[]) requested(order_id,quote_id,edition)
  CROSS JOIN LATERAL (SELECT (payload->>'vatRateBasisPoints')::integer AS rate FROM public.events WHERE tenant_id=${tenantId} AND order_id=requested.order_id AND event_type='QUOTE_VAT_FROM_COMPANY_V1' AND payload->>'quoteId'=requested.quote_id AND (payload->>'edition')::integer=requested.edition LIMIT 2) source`);
 for(const [orderId,{quote,sourcePositions,scaled}] of prepared){
  try{
   const fallback=vatRows.filter(row=>row.sourceOrderId===orderId);
   if(fallback.length>1)throw Error('QUOTE_VAT_SOURCE_AMBIGUOUS');
  quote.totalNetCents=scaled.totalNetCents;quote.legacyMinutesAllocated=scaled.legacyMinutesAllocated??false;
  quote.positions=quote.positions.map(row=>{
    const resolved=scaled.positions.find(priced=>priced.position===row.position)!;
    const original=sourcePositions.find(priced=>priced.position===row.position)!;
    return {...row,lineTotalCents:resolved.lineTotalCents,unit:original.unit??null,plannedMinutes:resolved.plannedMinutes??null,vatRateBasisPoints:original.vatRateBasisPoints??fallback[0]?.rate??null};
  });
  const rates=new Set(quote.positions.map(row=>row.vatRateBasisPoints));
  quote.vatRateBasisPoints=rates.size===1?quote.positions[0].vatRateBasisPoints:null;
  quote.plannedHours=scaled.plannedHours??scaled.calculation?.hours??null;
   result.set(orderId,quote);
  }catch(error){result.set(orderId,error instanceof Error?error:new Error('ORDER_CARD_QUOTE_PRICE_INVALID',{cause:error}));}
 }
 return new Map(ids.map(id=>{
  const quote=result.get(id);if(quote===undefined)throw Error('ORDER_CARD_QUOTE_PRICE_INVALID');
  return [id,quote];
 }));
}

/** Only the existing conversion/invoice transaction binds missing historical facts. No price copy. */
export async function bindOrderQuoteCommercialTerms(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,orderId:string){
 let quote=await readOrderCommercialQuote(tx,auth.tenantId,orderId);
 const write=async(kind:'QUOTE_VAT_FROM_COMPANY_V1'|'QUOTE_MINUTES_FROM_TOTAL_V1',description:string,payload:Record<string,unknown>)=>{
  const bytes=createHash('sha256').update(kind+':'+auth.tenantId+':'+orderId).digest();bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
  const h=bytes.subarray(0,16).toString('hex'),key=`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  const prior=await tx.execute(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND client_event_id=${key}::uuid AND event_type=${kind}`);
  if(prior.length)return;
  await tx.execute(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,created_at)
    VALUES(${randomUUID()},${auth.tenantId},${orderId},${kind},${description},${JSON.stringify({quoteId:quote.quoteId,edition:quote.edition,...payload})}::jsonb,'success',${auth.userId}::uuid,${key}::uuid,1,statement_timestamp() AT TIME ZONE 'UTC')`);
 };
 if(quote.positions.some(row=>row.vatRateBasisPoints===null)){
  const rates=await tx.execute<{rate:0|700|1900|null}>(sql`SELECT invoice_vat_rate_basis_points AS rate FROM public.company_settings WHERE tenant_id=${auth.tenantId}`);
  const rate=rates.length===1?rates[0].rate:null;
  if(rate!==null){await write('QUOTE_VAT_FROM_COMPANY_V1','Steuersatz aus Firmendaten übernommen',{vatRateBasisPoints:rate});quote=await readOrderCommercialQuote(tx,auth.tenantId,orderId);}
 }
 if(quote.legacyMinutesAllocated)await write('QUOTE_MINUTES_FROM_TOTAL_V1','Arbeitszeit aus KV-Gesamtzeit verteilt',{positions:quote.positions.map(row=>({position:row.position,plannedMinutes:row.plannedMinutes}))});
 return quote;
}
