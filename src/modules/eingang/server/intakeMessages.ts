import 'server-only';
import {sql} from 'drizzle-orm';
import {hasAuthorizationArea,resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {ACCESS_AREAS} from '@/lib/auth/authorizationContract';
import {MESSAGE_FILTERS,type MessageFilter,type IntakeMessage,type IntakeMessagesResult} from '../messageContract';

/** One projection of intake_item; no communications/phone_notes shadow inbox. */
export async function readIntakeMessages(filter:unknown='offen'):Promise<IntakeMessagesResult>{
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
   const messages=await tx.execute<IntakeMessage>(sql`SELECT source.id::text,source.version,source.kanal AS channel,source.richtung AS direction,
    source.zuordnung AS assignment,source.einsatz AS usage,source.absender_name AS "senderName",source.absender_adresse AS "senderAddress",source.gruppe_adresse AS "groupAddress",source.betreff AS subject,source.text,
    coalesce(source.empfangen_am,source.erstellt_am)::text AS at,source.kunde_id AS "customerId",context.customer_name AS "customerName",context.customer_type AS "customerType",
    source.vorgang_id AS "orderId",source.vorgang_art AS "orderKind",context.order_number AS "orderNumber",context.order_station AS "orderStation",context.goods,
    source.anliegen AS concerns,source.anliegen_offen AS "openConcerns",source.aussortiert AS "discardReason",source.erstellt_von::text AS "createdBy",
    ARRAY(SELECT file.id::text FROM public.intake_file file WHERE file.tenant_id=source.tenant_id AND file.item_id=source.id ORDER BY file.reihenfolge,file.id) AS "fileIds"
    FROM public.intake_item source LEFT JOIN private.v_intake_message_contexts_v1 context ON context.tenant_id=source.tenant_id AND context.item_id=source.id
    WHERE source.tenant_id=${auth.tenantId} AND ${filter==='aussortiert'?sql`source.aussortiert IS NOT NULL`:sql`source.aussortiert IS NULL`}
    AND (source.einsatz='offen' OR source.erstellt_am>=statement_timestamp()-interval '90 days')
    AND EXISTS(SELECT 1 FROM public.intake_item candidate WHERE candidate.tenant_id=source.tenant_id AND ${matches}
     AND (source.kunde_id IS NOT NULL AND candidate.kunde_id=source.kunde_id OR source.kunde_id IS NULL AND candidate.kunde_id IS NULL
      AND (source.gruppe_adresse IS NOT NULL AND candidate.gruppe_adresse=source.gruppe_adresse OR candidate.id=source.id)))
    ORDER BY coalesce(source.empfangen_am,source.erstellt_am),source.id`);
   return {code:'OK' as const,messages:[...messages],areas:ACCESS_AREAS.filter(area=>hasAuthorizationArea(auth,area)),currentLogin:auth.userId};
  });
 }catch(error){console.error('[INTAKE_MESSAGES_READ_FAILED]',error);return {code:'UNAVAILABLE',message:'Nachrichten konnten nicht geladen werden · Fehlercode: INTAKE_MESSAGES_READ_FAILED.'};}
}
