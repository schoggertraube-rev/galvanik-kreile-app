import {readIntakeActorTraces} from './actorRead';
import {intakeCaptureSnapshot} from './intakeCapture';
import {readMessageNextAction} from './messageNextAction';
import 'server-only';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {ACCESS_AREAS} from '@/lib/auth/authorizationContract';
import {readFallbackMessagePriority,MESSAGE_FILTERS,type MessageFilter,type IntakeMessage,type IntakeMessagesResult} from '../messageContract';

/** One projection of intake_item; no communications/phone_notes shadow inbox. */
export async function readIntakeMessages(filter:unknown='offen',sourceItemId?:string):Promise<IntakeMessagesResult>{
 if(sourceItemId!==undefined&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceItemId))return {code:'VALIDATION_ERROR',message:'Originalantwort ist ungültig.'};
 if(!MESSAGE_FILTERS.includes(filter as MessageFilter))return {code:'VALIDATION_ERROR',message:'Nachrichtenfilter ist ungültig.'};
 try{
  const result=await resolveAuthorization();if(!result.ok)return {code:result.reason==='AUTHORIZATION_UNAVAILABLE'?'UNAVAILABLE':'UNAUTHENTICATED',message:'Sitzung konnte nicht geprüft werden. Code: INTAKE_MESSAGES_SESSION.'};
  const auth=result.data;if(!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN',message:'Nachrichten benötigen das Recht Mails.'};
  return await withPrivilegedTenantTransaction(auth,async tx=>{
   const matches=filter==='offen'?sql`candidate.aussortiert IS NULL AND (candidate.einsatz='offen' OR candidate.richtung='rein' AND candidate.zuordnung='offen')`
    :filter==='zuordnen'?sql`candidate.aussortiert IS NULL AND candidate.zuordnung='offen'`
    :filter==='erledigt'?sql`candidate.aussortiert IS NULL AND candidate.einsatz IN ('erledigt','info')`
    :filter==='aussortiert'?sql`candidate.aussortiert IS NOT NULL`
    :sql`candidate.einsatz='offen' OR candidate.erstellt_am>=statement_timestamp()-interval '90 days'`;
   const messages=await tx.execute<IntakeMessage>(sql`SELECT source.id::text,source.version,source.kanal AS channel,source.richtung AS direction,source.sendestatus AS "sendState",
    source.zuordnung AS assignment,source.einsatz AS usage,source.absender_name AS "senderName",source.absender_adresse AS "senderAddress",source.gruppe_adresse AS "groupAddress",source.betreff AS subject,
    coalesce(source.text,(SELECT original.nachher->>'text' FROM public.intake_event created JOIN public.intake_event original
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
    WHERE source.tenant_id=${auth.tenantId} AND ${sourceItemId?sql`source.id=${sourceItemId}::uuid`:sql`true`} AND ${filter==='aussortiert'?sql`source.aussortiert IS NOT NULL`:sql`source.aussortiert IS NULL`}
    AND (source.einsatz='offen' OR source.erstellt_am>=statement_timestamp()-interval '90 days')
    AND EXISTS(SELECT 1 FROM public.intake_item candidate WHERE candidate.tenant_id=source.tenant_id AND ${matches}
     AND (source.kunde_id IS NOT NULL AND candidate.kunde_id=source.kunde_id OR source.kunde_id IS NULL AND candidate.kunde_id IS NULL
      AND (source.gruppe_adresse IS NOT NULL AND candidate.gruppe_adresse=source.gruppe_adresse OR candidate.id=source.id)))
    ORDER BY coalesce(source.empfangen_am,source.erstellt_am),source.id`);
   const actors=await readIntakeActorTraces(tx,auth,messages.map(row=>row.id));
   return {code:'OK' as const,messages:await Promise.all(messages.map(async row=>{const priority=readFallbackMessagePriority(row);const capture=priority.code==='OK'&&priority.rank===3?await intakeCaptureSnapshot(auth,row.id):undefined;return {...row,fallbackPriority:priority,nextActionRule:readMessageNextAction(auth,row,priority,capture),actorTrace:actors.get(row.id)};})),areas:ACCESS_AREAS.filter(area=>hasAuthorizationArea(auth,area)),currentLogin:auth.userId};
  });
 }catch(error){console.error('[INTAKE_MESSAGES_READ_FAILED]',error);return {code:'UNAVAILABLE',message:'Nachrichten konnten nicht geladen werden · Fehlercode: INTAKE_MESSAGES_READ_FAILED.'};}
}
