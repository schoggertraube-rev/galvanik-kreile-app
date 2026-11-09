import {readCaseActorTraces} from '@/lib/server/quoteJournalPort';
import 'server-only';
import {sql} from 'drizzle-orm';
import {resolveAuthorization,hasAuthorizationArea,type AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {Complaint,ComplaintFilter,ComplaintReadResult} from '../contract';
import {readComplaintGoodsReminderDates} from '@/lib/server/communicationPort';

export async function readComplaints(input:unknown=undefined):Promise<ComplaintReadResult>{
 try {const result=await resolveAuthorization();if(!result.ok)return {code:result.reason==='AUTHORIZATION_UNAVAILABLE'?'UNAVAILABLE':'UNAUTHENTICATED',message:'Sitzung konnte nicht geprüft werden.'};return readComplaintsForAuthorization(result.data,input);}
 catch(error){console.error('[COMPLAINT_READ_AUTH_FAILED]',error);return {code:'UNAVAILABLE',message:'Sitzung konnte nicht geprüft werden.'};}
}
/** The same projection feeds dialogs, both entity cards and Der Tag. */
export async function readComplaintsForAuthorization(auth:AuthorizationSnapshot,input:unknown=undefined):Promise<ComplaintReadResult>{
 const filter=input===undefined?{}:input;
 if(!filter||typeof filter!=='object'||Array.isArray(filter)||Object.keys(filter).some(key=>!['customerId','orderId','complaintId'].includes(key))
  ||Object.values(filter).some(value=>typeof value!=='string'||value.trim()!==value||!value||value.length>128))return {code:'VALIDATION_ERROR',message:'Reklamationsfilter ist ungültig.'};
 try{
  if(!(['auftraege','entscheiden','geld','kunden'] as const).some(area=>hasAuthorizationArea(auth,area)))return {code:'FORBIDDEN',message:'Reklamationen sind für diesen Login nicht freigegeben.'};
  const value=filter as ComplaintFilter;
  return await withPrivilegedTenantTransaction(auth,async tx=>{
   const money=hasAuthorizationArea(auth,'geld');
   const complaints=await tx.execute<Complaint>(sql`SELECT complaint.id,complaint.customer_id AS "customerId",complaint.order_id AS "orderId",complaint.intake_item_id::text AS "itemId",complaint.item_id AS "legacyPositionId",complaint.reason,
    complaint.station_id AS "stationId",complaint.description,complaint.photo_ids AS "photoIds",complaint.created_at::text AS "createdAt",complaint.resolved_at::text AS "resolvedAt",complaint.resolution,complaint.status,
    complaint.nummer,complaint.stand,complaint.bewertung,complaint.massnahme,complaint.nacharbeit_auftrag_id AS "nacharbeitAuftragId",complaint.version,complaint.teile,complaint.mangel,complaint.ware_zurueck AS "wareZurueck",complaint.begruendung,
    CASE WHEN ${money} THEN complaint.gutschrift_betrag::text END AS "gutschriftBetrag",CASE WHEN ${money} THEN complaint.gutschrift_nr END AS "gutschriftNr",
    complaint.abschluss_art AS "abschlussArt",complaint.abschluss_notiz AS "abschlussNotiz",context.rework_station AS "reworkStation",context.rework_ware AS "reworkGoods",
    context.source_order_number AS "orderNumber",context.source_customer_name AS "customerName",context.rework_order_number AS "reworkNumber",context.rework_ware_since::text AS "reworkGoodsSince",context.lifecycle_history AS history
    FROM public.complaints complaint LEFT JOIN public.v_complaint_rework_context_v1 context ON context.tenant_id=complaint.tenant_id AND context.complaint_id=complaint.id
    WHERE complaint.tenant_id=${auth.tenantId} AND ${value.customerId?sql`complaint.customer_id=${value.customerId}`:sql`true`} AND ${value.orderId?sql`complaint.order_id=${value.orderId}`:sql`true`} AND ${value.complaintId?sql`(complaint.id=${value.complaintId} OR complaint.nummer=${value.complaintId})`:sql`true`}
    ORDER BY complaint.created_at DESC,complaint.id DESC`);
   const actors=await readCaseActorTraces(tx,auth,complaints.filter(row=>Number.isSafeInteger(row.version)&&Number(row.version)>0).map(row=>({kind:'complaint' as const,id:row.id,version:row.version!})));
   const reminders=await readComplaintGoodsReminderDates(tx,auth,complaints.filter(row=>row.nacharbeitAuftragId&&row.stand==='massnahme_nacharbeit').map(row=>row.id));
   const sent=new Map(reminders.map(row=>[row.complaintId,row.sentAt]));
   return {code:'OK' as const,complaints:complaints.map(row=>({...row,...(actors.has('complaint:'+row.id)?{actorTrace:actors.get('complaint:'+row.id)}:{}),...(sent.has(row.id)?{goodsReminderSentAt:sent.get(row.id)!}:{})}))};
  });
 }catch(error){console.error('[COMPLAINT_READ_FAILED]',error);return {code:'UNAVAILABLE',message:'Reklamationen konnten nicht geladen werden. Fehlercode: COMPLAINT_READ_FAILED.'};}
}
