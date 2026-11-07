import 'server-only';
import {createHash, randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {QuoteCommandContext, QuoteCommandFailure, QuoteReadback,CreateQuoteInput} from './types';
import {readQuote,type QuoteSourceBinding,type QuoteFollowupBinding} from './quoteCommands';
import {readQuoteJournal,quoteJournalActorIsActive,appendQuoteJournal,readQuoteSentDocument} from '@/lib/server/quoteJournalPort';

type Identity = {quoteId:string; clientEventId:string; expectedVersion:number; edition:number;source?:NonNullable<CreateQuoteInput['source']>};
export type QuoteLifecycleInput = Identity & (
  | {action:'sent'; channel:'mail'|'druck'; evidence:string}
  | {action:'accept'; evidence:string}
  | {action:'conditional'; evidence:string}
  | {action:'reject'; reason:string}
);
type Result = QuoteCommandFailure | {code:'OK';quote:QuoteReadback;eventId:string;replayed:boolean;notices?:string[]};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function normalize(value:unknown):QuoteLifecycleInput|null {
  if (!value||typeof value!=='object'||Array.isArray(value)) return null;
  const row=value as Record<string,unknown>;
  const specific=row.action==='sent'?['channel','evidence']:(row.action==='accept'||row.action==='conditional')?['evidence']:row.action==='reject'?['reason']:null;
  if (!specific||Object.keys(row).sort().join('|')!==['quoteId','clientEventId','expectedVersion','edition','action',...specific,...(Object.hasOwn(row,'source')?['source']:[])].sort().join('|')) return null;
  if (typeof row.quoteId!=='string'||!uuid.test(row.quoteId)||typeof row.clientEventId!=='string'||!uuid.test(row.clientEventId)
    ||!Number.isSafeInteger(row.expectedVersion)||Number(row.expectedVersion)<1||!Number.isSafeInteger(row.edition)||Number(row.edition)<1) return null;
  if (row.action==='sent'&&row.channel!=='mail'&&row.channel!=='druck') return null;
  const proof=row.action==='reject'?row.reason:row.evidence;
  if (typeof proof!=='string'||proof.trim().length<3||proof.trim().length>(row.action==='reject'?2000:4000)) return null;
  if(Object.hasOwn(row,'source')){const source=row.source;if(row.action==='sent'||!source||typeof source!=='object'||Array.isArray(source)||Object.keys(source).sort().join(',')!=='itemId,message,version')return null;const item=source as Record<string,unknown>;if(typeof item.itemId!=='string'||!uuid.test(item.itemId)||!Number.isSafeInteger(item.version)||Number(item.version)<1||typeof item.message!=='boolean')return null;}
  const identity={quoteId:row.quoteId,clientEventId:row.clientEventId,expectedVersion:Number(row.expectedVersion),edition:Number(row.edition),...(Object.hasOwn(row,'source')?{source:row.source as NonNullable<CreateQuoteInput['source']>}:{} )};
  return row.action==='sent'?{...identity,action:'sent',channel:row.channel as 'mail'|'druck',evidence:proof.trim()}
    :row.action==='accept'||row.action==='conditional'?{...identity,action:row.action,evidence:proof.trim()}:{...identity,action:'reject',reason:proof.trim()};
}

/** Explicit manual sent/acceptance/decline records. Actual mail dispatch stays in communications. */
class QuoteLifecycleSourceFailure extends Error{constructor(readonly result:QuoteCommandFailure){super(result.code);}}

export async function changeQuoteLifecycleCommand(auth:QuoteCommandContext, raw:unknown,bindSource:QuoteSourceBinding|undefined,followup:QuoteFollowupBinding,options:{actualMail?:boolean}={}):Promise<Result> {
  const input=normalize(raw);
  if (!input) return {code:'VALIDATION_ERROR',message:'KV-Fassung, Nachweis oder Entscheidung fehlt.'};
  if (!auth.capabilities.canUpdateQuote||!auth.capabilities.canReadQuote) return {code:'FORBIDDEN',message:'KV-Entscheidung ist nicht freigegeben.'};
  const intent=createHash('sha256').update(JSON.stringify(input)).digest('hex');
  try {
    return await withPrivilegedTenantTransaction(auth,async tx=>{
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('quote-lifecycle:'||${auth.tenantId}||':'||${auth.userId}||':'||${input.clientEventId},0))`);
      const prior=await readQuoteJournal<{quoteId:string;intent:string}>(tx,auth,input.clientEventId);
      if (prior.length) {
        if (prior.length!==1||prior[0].eventType!=='QUOTE_LIFECYCLE_V04'||prior[0].payload.quoteId!==input.quoteId||prior[0].payload.intent!==intent) return {code:'CONFLICT',message:'Diese Speicherung wurde bereits anders verwendet.'};
        const quote=await readQuote(tx,auth.tenantId,input.quoteId);
        if (!quote?.lifecycle) throw Error('QUOTE_LIFECYCLE_REPLAY_INVALID');
        return {code:'OK',quote,eventId:prior[0].id,replayed:true};
      }
      const locked=await tx.execute(sql`SELECT id FROM private.quotes WHERE tenant_id=${auth.tenantId} AND id=${input.quoteId}::uuid FOR UPDATE`);
      if (locked.length!==1) return {code:'NOT_FOUND',message:'KV ist nicht verfügbar.'};
      const quote=await readQuote(tx,auth.tenantId,input.quoteId);
      if (!quote?.lifecycle) throw Error('QUOTE_LIFECYCLE_READBACK_INVALID');
      const life=quote.lifecycle;
      const actual=options.actualMail?await readQuoteSentDocument(tx,auth,input.clientEventId,input.quoteId):null;
      if(options.actualMail&&(!actual||input.action!=='sent'||input.channel!=='mail'||actual.document.version!==input.expectedVersion||actual.document.edition!==input.edition||input.evidence!=='Versandbeleg '+actual.threadId+' · PDF SHA-256 '+actual.document.sha256))return {code:'CONFLICT',message:'Ein passender tatsächlicher Mailbeleg zur KV-Fassung fehlt.'};
      const mailDocument=actual?.document??null;
      if(mailDocument&&(quote.version<mailDocument.version||life.edition<mailDocument.edition))throw Error('QUOTE_MAIL_FUTURE_DOCUMENT_INVALID');
      const currentMail=!mailDocument||mailDocument.edition===life.edition;
      const keepNewer=Boolean(mailDocument&&life.sentEdition!==null&&life.sentEdition>mailDocument.edition);
      const wantsFollowup=!mailDocument||currentMail&&!keepNewer&&life.stage!=='abgelaufen';
      if ((!mailDocument&&(quote.version!==input.expectedVersion||life.edition!==input.edition))||quote.linkedOrderId||life.declinedAt) return {code:'CONFLICT',message:'KV wurde geändert, abgesagt oder bereits umgewandelt. Aktuelle Fassung neu lesen.'};
      if (life.stage==='abgelaufen'&&input.action!=='reject'&&!mailDocument) return {code:'VALIDATION_ERROR',message:'KV ist abgelaufen. Vor einer Zusage die aktuelle Fassung erneuern.'};
      if ((input.action==='accept'||input.action==='conditional')&&life.sentEdition!==life.edition) return {code:'VALIDATION_ERROR',message:'Zusage gilt nur für die aktuelle versendete Fassung. Aktuellen KV senden.'};
      if (input.action==='accept'&&life.conditional?.edition===life.edition) return {code:'VALIDATION_ERROR',message:'Zusage mit Vorbehalt erfordert eine geänderte, neu versendete Fassung.'};
      if (!await quoteJournalActorIsActive(tx,auth)) return {code:'FORBIDDEN',message:'Login ist nicht mehr aktiv.'};
      if(wantsFollowup)await followup(tx,{quote,action:input.action,phase:'before'});
      const version=quote.version+1,eventId=randomUUID();
      await tx.execute(sql`INSERT INTO private.quote_positions(tenant_id,quote_id,revision,position,name,quantity,material,surface_requested,unit_price_cents,zeilen_gesamt_cents,unit)
        SELECT tenant_id,quote_id,${version},position,name,quantity,material,surface_requested,unit_price_cents,zeilen_gesamt_cents,unit FROM private.quote_positions
        WHERE tenant_id=${auth.tenantId} AND quote_id=${input.quoteId}::uuid AND revision=${quote.version}`);
      const mutation=input.action==='sent'
        ? keepNewer?sql`gesendet_fassung=gesendet_fassung`:sql`gesendet_fassung=${mailDocument?.edition??life.edition},gesendet_am=${actual?sql`${actual.sentAt}::timestamptz`:sql`statement_timestamp()`},gesendet_kanal=${input.channel}`
        : input.action==='accept'
          ? sql`zugesagt_fassung=fassung,zugesagt_am=statement_timestamp(),zusage_nachweis=${input.evidence},vorbehalt_fassung=NULL,vorbehalt_am=NULL,vorbehalt_grund=NULL`
          : input.action==='conditional'
            ? sql`zugesagt_fassung=NULL,zugesagt_am=NULL,zusage_nachweis=NULL,vorbehalt_fassung=fassung,vorbehalt_am=statement_timestamp(),vorbehalt_grund=${input.evidence}`
          : sql`abgesagt_am=statement_timestamp(),absage_grund=${input.reason}`;
      await tx.execute(sql`UPDATE private.quotes SET ${mutation},version=${version},updated_by=${auth.userId}::uuid,updated_at=statement_timestamp() WHERE tenant_id=${auth.tenantId} AND id=${input.quoteId}::uuid`);
      if(input.source){
        if(!bindSource)throw new QuoteLifecycleSourceFailure({code:'UNAVAILABLE',message:'Antwort-Anliegen konnte nicht mitgespeichert werden. Nichts geändert.'});
        const failure=await bindSource(tx,{source:input.source,quoteId:input.quoteId,customerId:quote.customerId,clientEventId:input.clientEventId,effect:input.action==='conditional'?'conditional':input.action==='accept'?'accept':'reject'});
        if(failure)throw new QuoteLifecycleSourceFailure(failure);
      }
      const followupNotice=wantsFollowup?await followup(tx,{quote,action:input.action,phase:'after'}):null;
      await appendQuoteJournal(tx,auth,{id:eventId,type:'QUOTE_LIFECYCLE_V04',clientEventId:input.clientEventId,correlationId:randomUUID(),version,description:input.action==='sent'?(mailDocument?'KV-Versand mit tatsächlichem Mailbeleg bestätigt':'KV-Versand ausdrücklich vermerkt'):input.action==='accept'?'KV-Zusage vermerkt':input.action==='conditional'?'KV-Vorbehalt vermerkt · neue Fassung erforderlich':'KV-Absage vermerkt',payload:{quoteId:input.quoteId,intent,action:input.action,edition:input.edition,before:life,proof:input.action==='reject'?input.reason:input.evidence,manual:input.action==='sent'&&!mailDocument,...(mailDocument?{mailDocument}:{}),...(input.source?{source:input.source}:{} )}});
      const result=await readQuote(tx,auth.tenantId,input.quoteId);
      if (!result?.lifecycle||result.version!==version) throw Error('QUOTE_LIFECYCLE_WRITE_READBACK_INVALID');
      const notices=[...(followupNotice?[followupNotice]:[]),...(!currentMail&&mailDocument?['E-Mail mit Fassung '+mailDocument.edition+' gesendet · aktuelle Fassung '+life.edition+(life.sentEdition===life.edition?' bleibt bereits versendet.':' ist noch nicht versendet.')]:[])];
      return {code:'OK',quote:result,eventId,replayed:false,...(notices.length?{notices}:{})};
    });
  } catch (error) {
    console.error('[QUOTE_LIFECYCLE_FAILED]',error instanceof Error?error.name:'UnknownError');
    if(error instanceof QuoteLifecycleSourceFailure)return error.result;
    return {code:'UNAVAILABLE',message:'KV-Entscheidung konnte nicht sicher bestätigt werden. Eingaben und Kennung behalten.'};
  }
}
