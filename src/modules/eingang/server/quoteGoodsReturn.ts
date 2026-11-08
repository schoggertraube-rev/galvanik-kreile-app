import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readQuoteGoodsContext} from '@/lib/server/quoteGoodsContextPort';

type Input={quoteId:string;receiptId:string;expectedQuoteVersion:number;expectedVersion:number;clientEventId:string;reason:string};
type ReturnReceipt={eventId:string;receiptId:string;quoteId:string;quoteNumber:string;customerId:string;customerName:string;location:string;quantity:number;reason:string;actorId:string;actorName:string;returnedAt:string};
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export async function returnQuoteGoodsReceipt(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {code:'VALIDATION_ERROR' as const,message:'KV, Warenbeleg und Grund fehlen.'};
 const input=raw as Input;
 if(Object.keys(input).sort().join(',')!=='clientEventId,expectedQuoteVersion,expectedVersion,quoteId,reason,receiptId'||![input.quoteId,input.receiptId,input.clientEventId].every(uuid)||![input.expectedQuoteVersion,input.expectedVersion].every(v=>Number.isSafeInteger(v)&&v>0)||typeof input.reason!=='string'||input.reason.trim().length<3||input.reason.length>2000)return {code:'VALIDATION_ERROR' as const,message:'KV, Versionen und ein Rückgabegrund sind erforderlich.'};
 const authorized=await resolveAuthorization();if(!authorized.ok)return {code:'UNAUTHENTICATED' as const,message:authorized.message};
 const auth=authorized.data,normalized={quoteId:input.quoteId,receiptId:input.receiptId,expectedQuoteVersion:input.expectedQuoteVersion,expectedVersion:input.expectedVersion,clientEventId:input.clientEventId,reason:input.reason.trim()},intent=createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('quote-goods-return:'||${auth.tenantId}||':'||${input.clientEventId},0))`);
  const quote=await readQuoteGoodsContext(tx,auth,input.quoteId);if(!quote)return {code:'NOT_FOUND' as const,message:'KV nicht verfügbar.'};
  const prior=await tx.execute<{von:string;nachher:{intent:string;receipt:ReturnReceipt}}>(sql`SELECT von,nachher FROM public.intake_event WHERE tenant_id=${auth.tenantId} AND art='ware' AND befehl_id=${input.clientEventId}::uuid AND nachher->>'action'='kv.ware_zurueckgegeben'`);
  if(prior.length)return prior.length===1&&prior[0].von===auth.userId&&prior[0].nachher.intent===intent?{code:'OK' as const,receipt:prior[0].nachher.receipt,replayed:true}:{code:'CONFLICT' as const,message:'Diese Rückgabekennung wurde anders verwendet.'};
  if(quote.version!==input.expectedQuoteVersion||quote.linkedOrderId||!quote.declined)return {code:'CONFLICT' as const,message:'Rückgabe ohne Auftrag benötigt den aktuellen abgesagten KV.'};
  const [row]=await tx.execute<{id:string;item_id:string|null;version:number;status:string;auftrag_id:string|null;lagerort:string;mengen:Array<{bestaetigt:number|null}>}>(sql`SELECT id,item_id,version,status,auftrag_id,lagerort,mengen FROM public.goods_receipt WHERE tenant_id=${auth.tenantId} AND id=${input.receiptId}::uuid AND kv_id=${input.quoteId}::uuid FOR UPDATE`);
  if(!row)return {code:'NOT_FOUND' as const,message:'Warenbeleg gehört nicht zu diesem KV.'};
  const [current]=await tx.execute<{rueckgabe:ReturnReceipt|null}>(sql`SELECT rueckgabe FROM public.v_quote_goods_receipt_v1 WHERE tenant_id=${auth.tenantId} AND id=${input.receiptId}::uuid`);
  if(!current||current.rueckgabe||row.version!==input.expectedVersion||row.status!=='angenommen'||row.auftrag_id||!row.item_id)return {code:'CONFLICT' as const,message:'Ware wurde bereits zurückgegeben, bearbeitet oder anders zugeordnet. Neu lesen.'};
  const [clock]=await tx.execute<{now:string}>(sql`SELECT statement_timestamp()::text AS now`);
  const receipt:ReturnReceipt={eventId:randomUUID(),receiptId:row.id,quoteId:quote.id,quoteNumber:quote.number,customerId:quote.customerId,customerName:quote.customerName,location:row.lagerort,quantity:row.mengen.reduce((n,line)=>n+Number(line.bestaetigt??0),0),reason:normalized.reason,actorId:auth.userId,actorName:auth.displayName,returnedAt:clock.now};
  await tx.execute(sql`INSERT INTO public.intake_event(id,tenant_id,item_id,art,befehl_id,von,vorher,nachher) VALUES(${receipt.eventId}::uuid,${auth.tenantId},${row.item_id}::uuid,'ware',${input.clientEventId}::uuid,${auth.userId},${JSON.stringify(row)}::jsonb,${JSON.stringify({action:'kv.ware_zurueckgegeben',receiptId:row.id,intent,receipt})}::jsonb)`);
  await tx.execute(sql`UPDATE public.goods_receipt SET version=version+1 WHERE tenant_id=${auth.tenantId} AND id=${row.id}::uuid AND version=${input.expectedVersion}`);
  const [readback]=await tx.execute<{rueckgabe:ReturnReceipt}>(sql`SELECT rueckgabe FROM public.v_quote_goods_receipt_v1 WHERE tenant_id=${auth.tenantId} AND id=${row.id}::uuid`);
  if(readback?.rueckgabe?.eventId!==receipt.eventId)throw Error('QUOTE_GOODS_RETURN_READBACK_INVALID');
  return {code:'OK' as const,receipt:readback.rueckgabe,replayed:false};
 });}catch(cause){console.error('[QUOTE_GOODS_RETURN_FAILED]',cause instanceof Error?cause.name:'UnknownError');return {code:'UNAVAILABLE' as const,message:'Rückgabe ist ungeklärt. Eingaben und dieselbe Kennung behalten.'};}
}

export async function readQuoteGoodsReturns(quoteId:unknown){
 if(!uuid(quoteId))return {code:'VALIDATION_ERROR' as const,message:'KV-Kennung fehlt.'};
 const authorized=await resolveAuthorization();if(!authorized.ok)return {code:'UNAUTHENTICATED' as const,message:authorized.message};
 try{return await withPrivilegedTenantTransaction(authorized.data,async tx=>{const rows=await tx.execute<{rueckgabe:ReturnReceipt}>(sql`SELECT rueckgabe FROM public.v_quote_goods_receipt_v1 WHERE tenant_id=${authorized.data.tenantId} AND kv_id=${quoteId}::uuid AND rueckgabe IS NOT NULL ORDER BY erstellt_am,id`);return {code:'OK' as const,receipts:rows.map(row=>row.rueckgabe)};});}catch(cause){console.error('[QUOTE_GOODS_RETURNS_READ_FAILED]',cause instanceof Error?cause.name:'UnknownError');return {code:'UNAVAILABLE' as const,message:'Rückgabebelege konnten nicht geladen werden.'};}
}
