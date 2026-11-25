import {OFFLINE_DEVICE_READ_COPY} from '@/ui/situationCatalog';
import {mailImportFailureProjection} from './intakeMailFailureRead';
import {openIntakePredicate} from './openIntakePredicate';
import {readIntakeActorTraces} from './actorRead';
import {intakeCaptureSnapshot} from './intakeCapture';
import {readMessageNextAction} from './messageNextAction';
import {priceTaskReceipt} from './intakePriceTaskReceipt';
import 'server-only';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,resolveAuthorization,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {authorizationReadContext,type AuthorizedReadContext} from '@/lib/server/authorizationReadContext';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {ACCESS_AREAS} from '@/lib/auth/authorizationContract';
import {readFallbackMessagePriority,MESSAGE_FILTERS,type MessageFilter,type IntakeMessage,type IntakeMessagesResult,type IntakeMessageSourcesResult} from '../messageContract';

function invalidMessageRead(filter:unknown,sourceItemId?:string,changedSince?:string):Exclude<IntakeMessagesResult,{code:'OK'}>|null{
 if(changedSince!==undefined&&(!Number.isFinite(Date.parse(changedSince))||new Date(changedSince).toISOString()!==changedSince))return {code:'VALIDATION_ERROR',message:OFFLINE_DEVICE_READ_COPY.invalidWindow};
 if(sourceItemId!==undefined&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceItemId))return {code:'VALIDATION_ERROR',message:'Originalantwort ist ungültig.'};
 if(!MESSAGE_FILTERS.includes(filter as MessageFilter))return {code:'VALIDATION_ERROR',message:'Nachrichtenfilter ist ungültig.'};
 return null;
}
/** One projection of intake_item; no communications/phone_notes shadow inbox. */
export async function readIntakeMessages(filter:unknown='offen',sourceItemId?:string,changedSince?:string):Promise<IntakeMessagesResult>{
 const invalid=invalidMessageRead(filter,sourceItemId,changedSince);if(invalid)return invalid;
 try{
  const result=await resolveAuthorization();if(!result.ok)return {code:result.reason==='AUTHORIZATION_UNAVAILABLE'?'UNAVAILABLE':'UNAUTHENTICATED',message:'Sitzung konnte nicht geprüft werden. Code: INTAKE_MESSAGES_SESSION.'};
  return readIntakeMessagesForAuthorization(result.data,filter,sourceItemId,changedSince);
 }catch(error){console.error('[INTAKE_MESSAGES_READ_FAILED]',error);return {code:'UNAVAILABLE',message:'Nachrichten konnten nicht geladen werden · Fehlercode: INTAKE_MESSAGES_READ_FAILED.'};}
}
/** Same SQL/originals for the live wrapper and the identity-free source reader.
 * Current login, effective areas and live U2 commands remain session output. */
export function readIntakeMessagesForAuthorization(auth:AuthorizationSnapshot,filter?:unknown,sourceItemId?:string,changedSince?:string):Promise<IntakeMessagesResult>;
export function readIntakeMessagesForAuthorization(auth:AuthorizedReadContext,filter?:unknown,sourceItemId?:string,changedSince?:string):Promise<IntakeMessageSourcesResult>;
export async function readIntakeMessagesForAuthorization(auth:AuthorizationSnapshot|AuthorizedReadContext,filter:unknown='offen',sourceItemId?:string,changedSince?:string):Promise<IntakeMessagesResult|IntakeMessageSourcesResult>{
 const invalid=invalidMessageRead(filter,sourceItemId,changedSince);if(invalid)return invalid;
 const readAuth='canReadArea'in auth?auth:authorizationReadContext(auth);
 try{
  if(!readAuth.canReadArea('mails'))return {code:'FORBIDDEN',message:'Nachrichten benötigen das Recht Mails.'};
  const canReadPrices=readAuth.canReadArea('preise');
  return await withPrivilegedTenantTransaction(auth,async tx=>{
   const deviceMatches=(alias:'source'|'candidate')=>{const row=sql.identifier(alias);return sql`(${openIntakePredicate(alias)} OR EXISTS(SELECT 1 FROM public.intake_event changed WHERE changed.tenant_id=${row}.tenant_id AND changed.item_id=${row}.id AND changed.zeit>=${changedSince}::timestamptz))`;};
   const matches=changedSince!==undefined?deviceMatches('candidate'):filter==='offen'?openIntakePredicate('candidate')
    :filter==='zuordnen'?sql`candidate.aussortiert IS NULL AND candidate.zuordnung='offen'`
    :filter==='erledigt'?sql`candidate.aussortiert IS NULL AND candidate.einsatz IN ('erledigt','info')`
    :filter==='aussortiert'?sql`candidate.aussortiert IS NOT NULL`
    :sql`candidate.einsatz='offen' OR candidate.erstellt_am>=statement_timestamp()-interval '90 days'`;
   const messages=await tx.execute<IntakeMessage&{priceTaskReceipt:boolean}>(sql`SELECT preisbeleg.id IS NOT NULL AS "priceTaskReceipt",${mailImportFailureProjection()} AS "importFailure",source.id::text,source.graph_message_id AS "graphMessageId",source.version,(SELECT max(changed.zeit)::text FROM public.intake_event changed WHERE changed.tenant_id=source.tenant_id AND changed.item_id=source.id) AS "serverChangedAt",source.kanal AS channel,source.richtung AS direction,source.sendestatus AS "sendState",
    source.zuordnung AS assignment,source.einsatz AS usage,source.absender_name AS "senderName",source.absender_adresse AS "senderAddress",source.gruppe_adresse AS "groupAddress",source.betreff AS subject,
    coalesce(preisbeleg.text,source.text,(SELECT original.nachher->>'text' FROM public.intake_event created JOIN public.intake_event original
      ON original.tenant_id=created.tenant_id AND original.item_id::text=created.nachher->>'textSourceId' AND original.id::text=created.nachher->>'originalTextEventId'
      WHERE source.fortsetzung_von IS NOT NULL AND created.tenant_id=source.tenant_id AND created.item_id=source.id AND created.art='angelegt' ORDER BY created.zeit,created.id LIMIT 1)) AS text,
    coalesce(source.empfangen_am,source.erstellt_am)::text AS at,source.kunde_id AS "customerId",context.customer_name AS "customerName",context.customer_type AS "customerType",
    source.vorgang_id AS "orderId",source.vorgang_art AS "orderKind",context.order_number AS "orderNumber",context.order_station AS "orderStation",context.goods,
    source.anliegen AS concerns,source.anliegen_offen AS "openConcerns",source.aussortiert AS "discardReason",source.erstellt_von::text AS "createdBy",
    ARRAY(SELECT file.id::text FROM public.intake_file file WHERE file.tenant_id=source.tenant_id AND (file.item_id=source.id OR EXISTS(
      SELECT 1 FROM public.intake_event created WHERE source.fortsetzung_von IS NOT NULL AND created.tenant_id=source.tenant_id
        AND created.item_id=source.id AND created.art='angelegt' AND jsonb_exists(created.nachher->'originalFileIds',file.id::text))) ORDER BY file.reihenfolge,file.id) AS "fileIds",
    (SELECT coalesce(jsonb_agg(jsonb_build_object('id',file.id::text,'name',file.dateiname) ORDER BY file.reihenfolge,file.id),'[]'::jsonb) FROM public.intake_file file WHERE file.tenant_id=source.tenant_id AND (file.item_id=source.id OR EXISTS(
      SELECT 1 FROM public.intake_event created WHERE source.fortsetzung_von IS NOT NULL AND created.tenant_id=source.tenant_id
        AND created.item_id=source.id AND created.art='angelegt' AND jsonb_exists(created.nachher->'originalFileIds',file.id::text)))) AS files
    FROM public.intake_item source LEFT JOIN private.v_intake_message_contexts_v1 context ON context.tenant_id=source.tenant_id AND context.item_id=source.id
    LEFT JOIN LATERAL (${priceTaskReceipt('source')}) preisbeleg ON true
    WHERE source.tenant_id=${auth.tenantId} AND ${sourceItemId?sql`source.id=${sourceItemId}::uuid`:sql`true`} AND ${changedSince!==undefined?sql`true`:filter==='aussortiert'?sql`source.aussortiert IS NOT NULL`:sql`source.aussortiert IS NULL`}
    AND (${canReadPrices} OR preisbeleg.id IS NULL)
    AND ${changedSince!==undefined?deviceMatches('source'):sql`(source.einsatz='offen' OR source.erstellt_am>=statement_timestamp()-interval '90 days')`}
    AND EXISTS(SELECT 1 FROM public.intake_item candidate WHERE candidate.tenant_id=source.tenant_id AND ${matches}
     AND (${canReadPrices} OR NOT EXISTS (${priceTaskReceipt('candidate')}))
     AND (source.kunde_id IS NOT NULL AND candidate.kunde_id=source.kunde_id OR source.kunde_id IS NULL AND candidate.kunde_id IS NULL
      AND (source.gruppe_adresse IS NOT NULL AND candidate.gruppe_adresse=source.gruppe_adresse OR candidate.id=source.id)))
    ORDER BY coalesce(source.empfangen_am,source.erstellt_am),source.id`);
   const actors=await readIntakeActorTraces(tx,auth,messages.map(row=>row.id));
   const sources=await Promise.all(messages.map(async row=>{const priority=readFallbackMessagePriority(row);const capture=priority.code==='OK'&&priority.rank===3?await intakeCaptureSnapshot(auth,row.id):undefined;return {row,priority,capture};}));
   const priceProtectedMessageIds:string[]=[];
   const messageFacts=sources.map(({row:{priceTaskReceipt,...row},priority})=>{
    if(priceTaskReceipt)priceProtectedMessageIds.push(row.id);
    return {...row,fallbackPriority:priority,actorTrace:actors.get(row.id)};
   });
   const source={code:'OK' as const,messages:messageFacts,priceProtectedMessageIds,captures:sources.flatMap(({row,capture})=>capture===undefined?[]:[{itemId:row.id,value:capture}])};
   return 'canReadArea'in auth?source:projectIntakeMessageSources(auth,source);
  });
 }catch(error){console.error('[INTAKE_MESSAGES_READ_FAILED]',error);return {code:'UNAVAILABLE',message:'Nachrichten konnten nicht geladen werden · Fehlercode: INTAKE_MESSAGES_READ_FAILED.'};}
}
/** The existing personal U2 projection is shared with qualified model facts. */
export function projectIntakeMessageSources(auth:AuthorizationSnapshot,source:IntakeMessageSourcesResult):IntakeMessagesResult{
 if(!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN',message:'Nachrichten benötigen das Recht Mails.'};
 if(source.code!=='OK')return source;
 const canReadPrices=hasAuthorizationArea(auth,'preise');
 const priceProtected=new Set(source.priceProtectedMessageIds);
 return {code:'OK',messages:source.messages.flatMap(message=>{
  // Persisted Today snapshots from before this change still carry the marker on the row.
  const {priceTaskReceipt,...row}=message as IntakeMessage&{priceTaskReceipt?:boolean};
  if(!canReadPrices&&(priceTaskReceipt||priceProtected.has(row.id)))return [];
  const priority=row.fallbackPriority??readFallbackMessagePriority(row);
  const capture=source.captures.find(value=>value.itemId===row.id)?.value;
  return [{...row,fallbackPriority:priority,nextActionRule:readMessageNextAction(auth,row,priority,capture)}];
 }),areas:ACCESS_AREAS.filter(area=>hasAuthorizationArea(auth,area)),currentLogin:auth.userId};
}
