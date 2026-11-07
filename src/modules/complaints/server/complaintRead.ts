import 'server-only';
import {sql} from 'drizzle-orm';
import {resolveAuthorization,hasAuthorizationArea} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {Complaint,ComplaintFilter,ComplaintReadResult} from '../contract';

export async function readComplaints(input:unknown=undefined):Promise<ComplaintReadResult>{
 const filter=input===undefined?{}:input;
 if(!filter||typeof filter!=='object'||Array.isArray(filter)||Object.keys(filter).some(key=>!['customerId','orderId'].includes(key))
  ||Object.values(filter).some(value=>typeof value!=='string'||value.trim()!==value||!value||value.length>128))return {code:'VALIDATION_ERROR',message:'Reklamationsfilter ist ungültig.'};
 try{
  const result=await resolveAuthorization();if(!result.ok)return {code:result.reason==='AUTHORIZATION_UNAVAILABLE'?'UNAVAILABLE':'UNAUTHENTICATED',message:'Sitzung konnte nicht geprüft werden.'};
  const auth=result.data;if(!(['auftraege','entscheiden','geld','kunden'] as const).some(area=>hasAuthorizationArea(auth,area)))return {code:'FORBIDDEN',message:'Reklamationen sind für diesen Login nicht freigegeben.'};
  const value=filter as ComplaintFilter;
  return await withPrivilegedTenantTransaction(auth,async tx=>{
   const money=hasAuthorizationArea(auth,'geld');
   const complaints=await tx.execute<Complaint>(sql`SELECT id,customer_id AS "customerId",order_id AS "orderId",intake_item_id::text AS "itemId",item_id AS "legacyPositionId",reason,
    station_id AS "stationId",description,photo_ids AS "photoIds",created_at::text AS "createdAt",resolved_at::text AS "resolvedAt",resolution,status,
    nummer,stand,bewertung,massnahme,nacharbeit_auftrag_id AS "nacharbeitAuftragId",version,teile,mangel,ware_zurueck AS "wareZurueck",begruendung,
    CASE WHEN ${money} THEN gutschrift_betrag::text END AS "gutschriftBetrag",CASE WHEN ${money} THEN gutschrift_nr END AS "gutschriftNr",
    abschluss_art AS "abschlussArt",abschluss_notiz AS "abschlussNotiz"
    FROM public.complaints WHERE tenant_id=${auth.tenantId} AND ${value.customerId?sql`customer_id=${value.customerId}`:sql`true`} AND ${value.orderId?sql`order_id=${value.orderId}`:sql`true`}
    ORDER BY created_at DESC,id DESC`);
   return {code:'OK' as const,complaints:[...complaints]};
  });
 }catch(error){console.error('[COMPLAINT_READ_FAILED]',error);return {code:'UNAVAILABLE',message:'Reklamationen konnten nicht geladen werden. Fehlercode: COMPLAINT_READ_FAILED.'};}
}
