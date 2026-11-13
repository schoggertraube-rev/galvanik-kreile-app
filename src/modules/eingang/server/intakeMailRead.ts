import {MAIL_IMPORT_COPY} from '@/ui/situationCatalog';
import {mailImportFailureProjection} from './intakeMailFailureRead';
import {openIntakePredicate} from './openIntakePredicate';
import 'server-only';
import {sql} from 'drizzle-orm';
import {resolveAuthorization,hasAuthorizationArea} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {IntakeMailSelectionResult,IntakeMailSummary,MailImportFailure} from '../mailSelectionContract';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';

/** Correspondence follows the current canonical association, including later reassignment. */
export async function readLinkedIntakeMails(auth:AuthorizationSnapshot,target:{targetType:'CUSTOMER'|'ORDER';targetId:string}){
 if(!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN' as const,message:'Mail-Inhalte benötigen Mails.'};
 try{const data=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{id:string;internetMessageId:string|null;subject:string;senderName:string;senderAddress:string;receivedAt:string|null;preview:string;body:string;hasAttachments:boolean|null;importFailure:MailImportFailure|null}>(sql`
  SELECT ${mailImportFailureProjection()} AS "importFailure",source.graph_message_id AS id,source.internet_message_id AS "internetMessageId",coalesce(source.betreff,'Betreff fehlt') AS subject,
   coalesce(source.absender_name,'Absender fehlt') AS "senderName",coalesce(source.absender_adresse,'Adresse fehlt') AS "senderAddress",source.empfangen_am::text AS "receivedAt",coalesce(source.text,'Inhalt fehlt') AS preview,coalesce(source.text,'Inhalt fehlt') AS body,
   CASE WHEN ${MAIL_IMPORT_COPY.failed}=ANY(source.kennzeichen) THEN NULL ELSE EXISTS(SELECT 1 FROM public.intake_file file JOIN public.intake_event original ON original.tenant_id=file.tenant_id AND original.item_id=file.item_id AND original.art='original_gespeichert' AND original.nachher->>'fileId'=file.id::text WHERE file.tenant_id=source.tenant_id AND file.item_id=source.id AND file.art<>'mime') END AS "hasAttachments"
  FROM public.intake_item source WHERE source.tenant_id=${auth.tenantId} AND source.kanal='mail' AND source.graph_message_id IS NOT NULL
   AND (${target.targetType==='CUSTOMER'} AND source.kunde_id=${target.targetId} OR ${target.targetType==='ORDER'} AND source.vorgang_art='auftrag' AND source.vorgang_id=${target.targetId}) ORDER BY source.empfangen_am DESC,source.id`));return {code:'OK' as const,data:[...data]};}
 catch(error){console.error('[INTAKE_MAIL_CORRESPONDENCE_READ_FAILED]',error instanceof Error?error.name:'UnknownError');return {code:'UNAVAILABLE' as const,message:'Zugeordnete Mail-Eingänge konnten nicht geladen werden.'};}
}

/** 3.4 selection reads the same originals and assignments as every other intake view. */
export async function readOpenIntakeMails():Promise<IntakeMailSelectionResult>{
 const authorization=await resolveAuthorization();
 if(!authorization.ok)return {code:'UNAUTHENTICATED',message:'Sitzung konnte nicht geprüft werden. Code: INTAKE_MAIL_SESSION_UNAVAILABLE.'};
 const auth=authorization.data;
 if(!hasAuthorizationArea(auth,'eingang')||!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN',message:'Mail-Auswahl erfordert Eingang und Mails.'};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const mails=await tx.execute<IntakeMailSummary>(sql`SELECT ${mailImportFailureProjection()} AS "importFailure",source.id::text,source.betreff AS subject,source.absender_name AS "senderName",source.absender_adresse AS "senderAddress",
    source.empfangen_am::text AS "receivedAt",source.kunde_id AS "customerId",
    CASE WHEN ${MAIL_IMPORT_COPY.failed}=ANY(source.kennzeichen) THEN NULL ELSE (SELECT count(*)::int FROM public.intake_file file WHERE file.tenant_id=source.tenant_id AND file.item_id=source.id AND file.art<>'mime' AND file.mime<>'message/rfc822' AND lower(file.dateiname) NOT LIKE '%.eml') END AS "fileCount"
    FROM public.intake_item source WHERE source.tenant_id=${auth.tenantId} AND source.kanal='mail' AND ${openIntakePredicate()} AND source.zuordnung='offen'
    ORDER BY source.empfangen_am DESC NULLS LAST,source.id DESC`);
  return {code:'OK' as const,mails};
 });}
 catch(error){console.error('[INTAKE_MAIL_SELECTION_READ_FAILED]',error);return {code:'UNAVAILABLE',message:'Offene Mails nicht verfügbar · Fehlercode: INTAKE_MAIL_SELECTION_READ_FAILED.'};}
}
