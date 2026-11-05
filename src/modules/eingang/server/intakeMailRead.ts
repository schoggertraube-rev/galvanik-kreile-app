import 'server-only';
import {sql} from 'drizzle-orm';
import {resolveAuthorization,hasAuthorizationArea} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {IntakeMailSelectionResult,IntakeMailSummary} from '../mailSelectionContract';

/** 3.4 selection reads the same originals and assignments as every other intake view. */
export async function readOpenIntakeMails():Promise<IntakeMailSelectionResult>{
 const authorization=await resolveAuthorization();
 if(!authorization.ok)return {code:'UNAUTHENTICATED',message:'Sitzung konnte nicht geprüft werden. Code: INTAKE_MAIL_SESSION_UNAVAILABLE.'};
 const auth=authorization.data;
 if(!hasAuthorizationArea(auth,'eingang')||!hasAuthorizationArea(auth,'mails'))return {code:'FORBIDDEN',message:'Mail-Auswahl erfordert Eingang und Mails.'};
 try{return await withPrivilegedTenantTransaction(auth,async tx=>{
  const mails=await tx.execute<IntakeMailSummary>(sql`SELECT source.id::text,source.betreff AS subject,source.absender_name AS "senderName",source.absender_adresse AS "senderAddress",
    source.empfangen_am::text AS "receivedAt",source.kunde_id AS "customerId",
    (SELECT count(*)::int FROM public.intake_file file WHERE file.tenant_id=source.tenant_id AND file.item_id=source.id AND file.art<>'mime' AND file.mime<>'message/rfc822' AND lower(file.dateiname) NOT LIKE '%.eml') AS "fileCount"
    FROM public.intake_item source WHERE source.tenant_id=${auth.tenantId} AND source.kanal='mail' AND source.zuordnung='offen' AND source.einsatz<>'verworfen'
    ORDER BY source.empfangen_am DESC NULLS LAST,source.id DESC`);
  return {code:'OK' as const,mails};
 });}
 catch(error){console.error('[INTAKE_MAIL_SELECTION_READ_FAILED]',error);return {code:'UNAVAILABLE',message:'Offene Mails nicht verfügbar · Fehlercode: INTAKE_MAIL_SELECTION_READ_FAILED.'};}
}
