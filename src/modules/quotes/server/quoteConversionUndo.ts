import 'server-only';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readQuote} from './quoteCommands';
import type {QuoteCommandContext,QuoteReadback} from './types';

type UndoInput={quoteId:string;expectedVersion:number;clientEventId:string;reason:string};
export async function reverseQuoteConversionCommand(auth:QuoteCommandContext,input:UndoInput){
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='clientEventId,expectedVersion,quoteId,reason'||typeof input.quoteId!=='string'||!uuid.test(input.quoteId)||typeof input.clientEventId!=='string'||!uuid.test(input.clientEventId)||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1||typeof input.reason!=='string'||input.reason.trim().length<3||input.reason.length>4000)return {code:'VALIDATION_ERROR' as const,message:'Rücknahme braucht KV, Version, Kennung und einen Grund.'};
 if(!auth.capabilities.canConvertQuote)return {code:'FORBIDDEN' as const,message:'Rücknahme ist für dieses Profil nicht freigegeben.'};
 const normalized={...input,reason:input.reason.trim()},hash=createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const rows=await tx.execute<{result_code:string;order_id:string|null;replayed:boolean;message:string|null}>(sql`SELECT * FROM private.reverse_quote_conversion_v1(${auth.tenantId},${auth.userId}::uuid,${normalized.quoteId}::uuid,${normalized.expectedVersion},${normalized.clientEventId}::uuid,${hash},${normalized.reason})`);
  if(rows.length!==1)throw Error('QUOTE_UNDO_RESULT_INVALID');const result=rows[0];
  if(result.result_code!=='OK')return {code:result.result_code==='VALIDATION_ERROR'?'VALIDATION_ERROR' as const:'CONFLICT' as const,message:result.message??'Auftrag kann nicht mehr zurückgenommen werden.'};
  const quote=await readQuote(tx,auth.tenantId,input.quoteId);if(!quote||!result.order_id)throw Error('QUOTE_UNDO_READBACK_INVALID');
  return {code:'OK' as const,quote,orderId:result.order_id,replayed:result.replayed};
 });}catch(error){const cause=error&&typeof error==='object'&&'cause'in error?error.cause:error;console.error('[QUOTE_CONVERSION_UNDO_FAILED]',cause instanceof Error?cause.message:'UnknownError');return {code:'UNAVAILABLE' as const,message:'Rücknahme konnte nicht sicher bestätigt werden. Mit derselben Kennung erneut prüfen.'};}
}

/** No local flag: current eligibility and past reversals are read from canonical receipts. */
export async function readQuoteUndoContext(auth:QuoteCommandContext,quote:QuoteReadback){
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const [row]=await tx.execute<{reason:string|null;historical:number}>(sql`SELECT CASE WHEN ${quote.linkedOrderId!==null} THEN private.quote_conversion_undo_reason_v1(${auth.tenantId},${quote.quoteId}::uuid) ELSE NULL END AS reason,(SELECT count(*)::integer FROM private.v_quote_conversion_receipts_v1 WHERE tenant_id=${auth.tenantId} AND quote_id=${quote.quoteId}::uuid AND integrity_ok) AS historical`);
  if(!row)throw Error('QUOTE_UNDO_CONTEXT_MISSING');return {ready:true,canUndo:quote.linkedOrderId!==null&&row.reason===null,reason:row.reason,automaticSuppressed:quote.linkedOrderId===null&&row.historical>0};
 });}catch(error){console.error('[QUOTE_UNDO_CONTEXT_FAILED]',error instanceof Error?error.message:'UnknownError');return {ready:false,canUndo:false,reason:'Rücknahme konnte nicht sicher gelesen werden.',automaticSuppressed:true};}
}
