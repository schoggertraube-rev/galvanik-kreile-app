import 'server-only';
import {createHash, randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {QuoteCommandContext, QuoteCommandFailure, QuoteReadback} from './types';
import {readQuote} from './quoteCommands';

type Identity = {quoteId:string; clientEventId:string; expectedVersion:number; edition:number};
export type QuoteLifecycleInput = Identity & (
  | {action:'sent'; channel:'mail'|'druck'; evidence:string}
  | {action:'accept'; evidence:string}
  | {action:'reject'; reason:string}
);
type Result = QuoteCommandFailure | {code:'OK';quote:QuoteReadback;eventId:string;replayed:boolean};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function normalize(value:unknown):QuoteLifecycleInput|null {
  if (!value||typeof value!=='object'||Array.isArray(value)) return null;
  const row=value as Record<string,unknown>;
  const specific=row.action==='sent'?['channel','evidence']:row.action==='accept'?['evidence']:row.action==='reject'?['reason']:null;
  if (!specific||Object.keys(row).sort().join('|')!==['quoteId','clientEventId','expectedVersion','edition','action',...specific].sort().join('|')) return null;
  if (typeof row.quoteId!=='string'||!uuid.test(row.quoteId)||typeof row.clientEventId!=='string'||!uuid.test(row.clientEventId)
    ||!Number.isSafeInteger(row.expectedVersion)||Number(row.expectedVersion)<1||!Number.isSafeInteger(row.edition)||Number(row.edition)<1) return null;
  if (row.action==='sent'&&row.channel!=='mail'&&row.channel!=='druck') return null;
  const proof=row.action==='reject'?row.reason:row.evidence;
  if (typeof proof!=='string'||proof.trim().length<3||proof.trim().length>(row.action==='reject'?2000:4000)) return null;
  const identity={quoteId:row.quoteId,clientEventId:row.clientEventId,expectedVersion:Number(row.expectedVersion),edition:Number(row.edition)};
  return row.action==='sent'?{...identity,action:'sent',channel:row.channel as 'mail'|'druck',evidence:proof.trim()}
    :row.action==='accept'?{...identity,action:'accept',evidence:proof.trim()}:{...identity,action:'reject',reason:proof.trim()};
}

/** Explicit manual sent/acceptance/decline records. Actual mail dispatch stays in communications. */
export async function changeQuoteLifecycleCommand(auth:QuoteCommandContext, raw:unknown):Promise<Result> {
  const input=normalize(raw);
  if (!input) return {code:'VALIDATION_ERROR',message:'KV-Fassung, Nachweis oder Entscheidung fehlt.'};
  if (!auth.capabilities.canUpdateQuote||!auth.capabilities.canReadQuote) return {code:'FORBIDDEN',message:'KV-Entscheidung ist nicht freigegeben.'};
  const intent=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  try {
    return await withPrivilegedTenantTransaction(auth,async tx=>{
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('quote-lifecycle:'||${auth.tenantId}||':'||${auth.userId}||':'||${input.clientEventId},0))`);
      const prior=await tx.execute<{id:string;payload:{quoteId:string;intent:string}}>(sql`SELECT id,payload FROM public.events WHERE tenant_id=${auth.tenantId} AND user_id=${auth.userId}::uuid AND client_event_id=${input.clientEventId}::uuid AND event_type='QUOTE_LIFECYCLE_V04'`);
      if (prior.length) {
        if (prior.length!==1||prior[0].payload.quoteId!==input.quoteId||prior[0].payload.intent!==intent) return {code:'CONFLICT',message:'Diese Speicherung wurde bereits anders verwendet.'};
        const quote=await readQuote(tx,auth.tenantId,input.quoteId);
        if (!quote?.lifecycle) throw Error('QUOTE_LIFECYCLE_REPLAY_INVALID');
        return {code:'OK',quote,eventId:prior[0].id,replayed:true};
      }
      const locked=await tx.execute(sql`SELECT id FROM private.quotes WHERE tenant_id=${auth.tenantId} AND id=${input.quoteId}::uuid FOR UPDATE`);
      if (locked.length!==1) return {code:'NOT_FOUND',message:'KV ist nicht verfügbar.'};
      const quote=await readQuote(tx,auth.tenantId,input.quoteId);
      if (!quote?.lifecycle) throw Error('QUOTE_LIFECYCLE_READBACK_INVALID');
      const life=quote.lifecycle;
      if (quote.version!==input.expectedVersion||life.edition!==input.edition||quote.linkedOrderId||life.declinedAt) return {code:'CONFLICT',message:'KV wurde geändert, abgesagt oder bereits umgewandelt. Aktuelle Fassung neu lesen.'};
      if (life.stage==='abgelaufen'&&input.action!=='reject') return {code:'VALIDATION_ERROR',message:'KV ist abgelaufen. Vor einer Zusage die aktuelle Fassung erneuern.'};
      if (input.action==='accept'&&life.sentEdition!==life.edition) return {code:'VALIDATION_ERROR',message:'Zusage gilt nur für die aktuelle versendete Fassung. Aktuellen KV senden.'};
      const actor=await tx.execute(sql`SELECT id FROM public.app_users WHERE tenant_id=${auth.tenantId} AND id=${auth.userId}::uuid AND active IS TRUE`);
      if (actor.length!==1) return {code:'FORBIDDEN',message:'Login ist nicht mehr aktiv.'};
      const version=quote.version+1,eventId=randomUUID();
      await tx.execute(sql`INSERT INTO private.quote_positions(tenant_id,quote_id,revision,position,name,quantity,material,surface_requested,unit_price_cents,zeilen_gesamt_cents,unit)
        SELECT tenant_id,quote_id,${version},position,name,quantity,material,surface_requested,unit_price_cents,zeilen_gesamt_cents,unit FROM private.quote_positions
        WHERE tenant_id=${auth.tenantId} AND quote_id=${input.quoteId}::uuid AND revision=${quote.version}`);
      const mutation=input.action==='sent'
        ? sql`gesendet_fassung=fassung,gesendet_am=statement_timestamp(),gesendet_kanal=${input.channel}`
        : input.action==='accept'
          ? sql`zugesagt_fassung=fassung,zugesagt_am=statement_timestamp(),zusage_nachweis=${input.evidence}`
          : sql`abgesagt_am=statement_timestamp(),absage_grund=${input.reason},nachfass_am=NULL`;
      await tx.execute(sql`UPDATE private.quotes SET ${mutation},version=${version},updated_by=${auth.userId}::uuid,updated_at=statement_timestamp() WHERE tenant_id=${auth.tenantId} AND id=${input.quoteId}::uuid`);
      await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,user_id,client_event_id,event_schema_version,correlation_id,aggregate_version,status,description,payload)
        VALUES(${eventId},${auth.tenantId},'QUOTE_LIFECYCLE_V04',${auth.userId}::uuid,${input.clientEventId}::uuid,1,${randomUUID()}::uuid,${version},'success',${input.action==='sent'?'KV-Versand ausdrücklich vermerkt':input.action==='accept'?'KV-Zusage vermerkt':'KV-Absage vermerkt'},${JSON.stringify({quoteId:input.quoteId,intent,action:input.action,edition:life.edition,before:life,proof:input.action==='reject'?input.reason:input.evidence,manual:input.action==='sent'})}::jsonb)`);
      const result=await readQuote(tx,auth.tenantId,input.quoteId);
      if (!result?.lifecycle||result.version!==version) throw Error('QUOTE_LIFECYCLE_WRITE_READBACK_INVALID');
      return {code:'OK',quote:result,eventId,replayed:false};
    });
  } catch (error) {
    console.error('[QUOTE_LIFECYCLE_FAILED]',error instanceof Error?error.name:'UnknownError');
    return {code:'UNAVAILABLE',message:'KV-Entscheidung konnte nicht sicher bestätigt werden. Eingaben und Kennung behalten.'};
  }
}
