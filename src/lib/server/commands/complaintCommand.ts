import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { hasAuthorizationArea, resolveAuthorization, type AuthorizationSnapshot } from '@/lib/server/authorization';
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from '@/lib/server/privilegedDb';
import { validComplaintCommand, type ComplaintCommand, type ComplaintWriteResult } from '@/modules/complaints/public';
import {readSecuredOrderPhotoIds} from '@/lib/server/domainAttachment';
import type { ComplaintState } from '@/modules/complaints/public';

type Failure = Exclude<ComplaintWriteResult, {code:'OK'}>;
type Row = { complaint_id:string; source_order_id:string; customer_id:string; nummer:string; stand:ComplaintState; version:number; bewertung:string|null; massnahme:string|null; nacharbeit_auftrag_id:string|null; begruendung:string|null; gutschrift_betrag:string|null; gutschrift_nr:string|null };
type Success = Extract<ComplaintWriteResult,{code:'OK'}>;
export type ComplaintSourceEffect = (tx:PrivilegedTenantTransaction, auth:AuthorizationSnapshot, input:{itemId:string;version:number;clientKey:string;complaintId:string;number:string;customerId:string;orderId:string})=>Promise<void>;

/** Limited source projection for 4.8; no invoice, price or other money fields. */
export async function readComplaintOrderSource(auth:AuthorizationSnapshot,orderId:string) {
  if(!['auftraege','entscheiden','geld','kunden'].some(area=>hasAuthorizationArea(auth,area as 'auftraege'|'entscheiden'|'geld'|'kunden')))return null;
  return withPrivilegedTenantTransaction(auth,async tx=>{
    const [order]=await tx.execute<{id:string;number:string;customerId:string;customerName:string;handoverMode:'pickup'|'shipping'|null}>(sql`SELECT orders.id,orders.order_number AS number,orders.customer_id AS "customerId",customer.name AS "customerName",orders.handover_mode AS "handoverMode" FROM public.orders orders JOIN public.customers customer ON customer.tenant_id=orders.tenant_id AND customer.id=orders.customer_id WHERE orders.tenant_id=${auth.tenantId} AND orders.id=${orderId}`);
    if(!order)return null;
    const items=await tx.execute<{id:string;name:string;quantity:number;unit:string|null;catalogServiceId:string|null;surfaceRequested:string}>(sql`SELECT id,name,quantity,unit,catalog_service_id AS "catalogServiceId",surface_requested AS "surfaceRequested" FROM public.items WHERE tenant_id=${auth.tenantId} AND order_id=${order.id} AND customer_id=${order.customerId} ORDER BY created_at,id`);
    return {...order,items:[...items]};
  });
}
/** Picker uses the persisted delivery event, never a later order edit date. */
export async function readComplaintOrderChoices(auth:AuthorizationSnapshot,customerId:string){
 if(!hasAuthorizationArea(auth,'auftraege'))return {code:'FORBIDDEN' as const,message:'Reklamation aufnehmen benötigt Aufträge.'};
 if(typeof customerId!=='string'||!customerId||customerId.length>128)return {code:'VALIDATION_ERROR' as const,message:'Kundenbezug ist ungültig.'};
 try{
  const rows=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{id:string;number:string;title:string}>(sql`SELECT orders.id,orders.order_number AS number,orders.title FROM public.orders orders
   JOIN LATERAL (SELECT max(event.created_at) AS delivered FROM public.events event WHERE event.tenant_id=orders.tenant_id AND event.order_id=orders.id AND (event.event_type LIKE 'ORDER_PICKED_UP_%' OR event.event_type LIKE 'ORDER_SHIPPED_%')) delivery ON delivery.delivered>=statement_timestamp()-interval '24 months'
   WHERE orders.tenant_id=${auth.tenantId} AND orders.customer_id=${customerId} AND orders.station IN ('abgeholt','versendet') ORDER BY delivery.delivered DESC,orders.id`));
  return {code:'OK' as const,orders:[...rows]};
 }catch(error){console.error('[COMPLAINT_ORDER_CHOICES_FAILED]',error);return {code:'UNAVAILABLE' as const,message:'Gelieferte Aufträge konnten nicht geladen werden.'};}
}
class Rejected extends Error { constructor(readonly result:Failure) { super(result.message); } }
function reject(code:Failure['code'],message:string):never { throw new Rejected({code,message}); }
function canonical(value:unknown):string {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value==='object') return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>JSON.stringify(key)+':'+canonical(item)).join(',')+'}';
  return JSON.stringify(value);
}
async function context(tx:PrivilegedTenantTransaction,tenant:string,id:string):Promise<Row> {
  await tx.execute(sql`SELECT id FROM public.complaints WHERE tenant_id=${tenant} AND id=${id} FOR UPDATE`);
  const rows=await tx.execute<Row>(sql`SELECT * FROM public.v_complaint_rework_context_v1 WHERE tenant_id=${tenant} AND complaint_id=${id}`);
  if(rows.length!==1)reject('NOT_FOUND','Reklamation ist nicht verfügbar.');
  return rows[0];
}
function mayWrite(auth:AuthorizationSnapshot,input:ComplaintCommand) {
  if(input.action==='aufnehmen')return hasAuthorizationArea(auth,'auftraege');
  if(input.action==='wieder_oeffnen')return hasAuthorizationArea(auth,'entscheiden');
  if(input.action==='gutschrift')return hasAuthorizationArea(auth,'geld');
  if(input.action==='entscheiden')return hasAuthorizationArea(auth,'entscheiden')&&(input.measure!=='gutschrift'||hasAuthorizationArea(auth,'geld'));
  return hasAuthorizationArea(auth,input.kind==='mail'?'kunden':'auftraege');
}

/** One tenant transaction contains the complaint row, source effect and before/after receipt. */
export async function executeComplaint(input:unknown,sourceEffect:ComplaintSourceEffect):Promise<ComplaintWriteResult> {
  if(!validComplaintCommand(input))return {code:'VALIDATION_ERROR',message:'Reklamation ist unvollständig oder enthält ungültige Angaben.'};
  try {
    const authorization=await resolveAuthorization();
    if(!authorization.ok)reject(authorization.reason==='AUTHORIZATION_UNAVAILABLE'?'UNAVAILABLE':'UNAUTHENTICATED','Sitzung konnte nicht geprüft werden.');
    const auth=authorization.data;
    if(!mayWrite(auth,input))reject('FORBIDDEN','Diese Reklamationsaktion ist für diesen Login nicht freigegeben.');
    return await withPrivilegedTenantTransaction(auth,async tx=>{
      // The same complaint lock is also used by the existing rework command.
      const key=input.action==='aufnehmen'?input.clientKey:input.complaintId;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('ein4b:rework:'||${auth.tenantId}||':'||${key},0))`);
      const requestHash=createHash('sha256').update(canonical(input)).digest('hex');
      const previous=await tx.execute<{user_id:string;payload:{requestHash:string;receipt:Success['receipt']}}>(sql`SELECT user_id::text,payload FROM public.events WHERE tenant_id=${auth.tenantId} AND client_event_id=${input.clientKey}::uuid AND event_type='COMPLAINT_CHANGED_V1'`);
      if(previous.length){
        if(previous.length!==1||previous[0].user_id!==auth.userId||previous[0].payload.requestHash!==requestHash)reject('CONFLICT','Diese Anfragekennung wurde bereits für andere Angaben verwendet.');
        return {code:'OK',receipt:previous[0].payload.receipt,replayed:true};
      }
      let before:Row|null=null,after:Row;
      if(input.action==='aufnehmen') {
        const [order]=await tx.execute<{id:string;customer_id:string;station:string}>(sql`SELECT id,customer_id,station FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=${input.orderId} FOR SHARE`);
        if(!order)reject('NOT_FOUND','Der zugehörige Auftrag ist nicht verfügbar.');
        if(order.station!=='abgeholt')reject('VALIDATION_ERROR','Reklamationen beziehen sich auf einen gelieferten Auftrag.');
        const items=await tx.execute<{id:string;quantity:number}>(sql`SELECT id,quantity FROM public.items WHERE tenant_id=${auth.tenantId} AND order_id=${input.orderId} AND customer_id=${order.customer_id}`);
        for(const part of input.parts){const item=items.find(row=>row.id===part.position_id);if(!item||part.menge>Number(item.quantity))reject('VALIDATION_ERROR','Menge betroffen muss zwischen 1 und geliefert liegen.');}
        if(input.photoIds.length){
          const orderPhotoIds=await readSecuredOrderPhotoIds(tx,auth,order.id,input.photoIds);
          const photos=await tx.execute<{id:string}>(sql`SELECT file.id::text AS id FROM public.intake_file file JOIN public.intake_item source ON source.tenant_id=file.tenant_id AND source.id=file.item_id WHERE file.tenant_id=${auth.tenantId} AND file.id::text IN (${sql.join(input.photoIds.map(id=>sql`${id}`),sql`, `)}) AND file.item_id=${input.intakeItemId}::uuid AND source.kunde_id=${order.customer_id} AND file.mime LIKE 'image/%' AND EXISTS(SELECT 1 FROM public.intake_event original WHERE original.tenant_id=file.tenant_id AND original.item_id=file.item_id AND original.art='original_gespeichert' AND original.nachher->>'fileId'=file.id::text)`);
          if(new Set([...orderPhotoIds,...photos.map(photo=>photo.id)]).size!==new Set(input.photoIds).size)reject('VALIDATION_ERROR','Ein Originalfoto ist nicht verfügbar.');
        }
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('complaint-number:'||${auth.tenantId},0))`);
        const [counter]=await tx.execute<{number:string}>(sql`SELECT 'RK-'||to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY')||'-'||lpad((coalesce(max(substring(nummer FROM '[0-9]+$')::integer),0)+1)::text,4,'0') AS number FROM public.complaints WHERE tenant_id=${auth.tenantId} AND nummer LIKE 'RK-'||to_char(statement_timestamp() AT TIME ZONE 'Europe/Berlin','YYYY')||'-%'`);
        const id=randomUUID();
        await tx.execute(sql`INSERT INTO public.complaints(id,tenant_id,order_id,customer_id,intake_item_id,reason,description,photo_ids,status,nummer,client_key,teile,mangel,fotos,ware_zurueck,stand,version,erstellt_von,erstellt_am)
          VALUES(${id},${auth.tenantId},${order.id},${order.customer_id},${input.intakeItemId}::uuid,${input.defect},${input.description},${JSON.stringify(input.photoIds)}::jsonb,'open',${counter.number},${input.clientKey}::uuid,${JSON.stringify(input.parts)}::jsonb,${input.defect},${JSON.stringify(input.photoIds)}::jsonb,${input.goodsReturn},'aufgenommen',1,${auth.userId}::uuid,statement_timestamp())`);
        if(input.intakeItemId)await sourceEffect(tx,auth,{itemId:input.intakeItemId,version:input.intakeVersion!,clientKey:input.clientKey,complaintId:id,number:counter.number,customerId:order.customer_id,orderId:order.id});
        after=await context(tx,auth.tenantId,id);
      } else {
        before=await context(tx,auth.tenantId,input.complaintId);
        if(before.version!==input.version)reject('CONFLICT','Reklamation wurde inzwischen geändert · bitte neu lesen.');
        let change;
        if(input.action==='entscheiden'){
          if(before.gutschrift_nr&&input.measure==='gutschrift')reject('VALIDATION_ERROR','Gutschrift '+before.gutschrift_nr+' besteht · keine zweite Gutschrift anlegen.');
          if(before.stand!=='aufgenommen')reject('CONFLICT','Die Reklamation wurde bereits entschieden.');
          change=sql`stand=${input.assessment==='abgelehnt'?'kunde_informieren':'massnahme_gutschrift'},bewertung=${input.assessment},massnahme=${input.measure},begruendung=${input.reason},gutschrift_betrag=${before.gutschrift_nr?before.gutschrift_betrag:input.creditCents===null?null:(input.creditCents/100).toFixed(2)}`;
        } else if(input.action==='gutschrift'){
          if(before.gutschrift_nr)reject('VALIDATION_ERROR','Gutschrift '+before.gutschrift_nr+' besteht · keine zweite Gutschrift anlegen.');
          if(before.stand!=='massnahme_gutschrift')reject('CONFLICT','Es ist keine Gutschrift offen.');
          change=sql`stand='kunde_informieren',gutschrift_betrag=${(input.creditCents/100).toFixed(2)},gutschrift_nr=${input.creditNumber}`;
        } else if(input.action==='wieder_oeffnen'){
          if(before.stand!=='abgeschlossen')reject('CONFLICT','Die Reklamation ist bereits offen.');
          change=sql`stand='aufgenommen',bewertung=NULL,massnahme=NULL,begruendung=NULL,abschluss_art=NULL,abschluss_notiz=NULL,abgeschlossen_am=NULL,abgeschlossen_von=NULL`;
        } else {
          if(before.stand==='abgeschlossen'||input.kind!=='zurueckgezogen'&&before.stand!=='kunde_informieren')reject('CONFLICT','Dieser Reklamationsstand kann so nicht abgeschlossen werden.');
          if(input.kind==='mail'){
            const sent=await tx.execute(sql`SELECT thread.id FROM public.communication_threads thread JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id AND message.direction='outgoing' AND message.channel='email' AND message.summary=${'Reklamation '+before.complaint_id+' · Ergebnis'} WHERE thread.tenant_id=${auth.tenantId} AND thread.id=${input.sentThreadId}::uuid AND thread.order_id=${before.source_order_id} AND thread.customer_id=${before.customer_id} AND thread.status='sent' AND thread.source='MS_GRAPH_OUT:'||${input.clientKey}`);
            if(sent.length!==1)reject('CONFLICT','Die zugehörige Ergebnis-Mail ist noch nicht sicher als gesendet bestätigt.');
          }
          if(input.kind==='zurueckgezogen'&&before.stand==='massnahme_nacharbeit'){
            const allowed=await tx.execute(sql`SELECT id FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=${before.nacharbeit_auftrag_id} AND station='angenommen' AND ware IN ('erwartet','da') FOR UPDATE`);
            if(allowed.length!==1)reject('VALIDATION_ERROR','Nacharbeit läuft – schließt mit dem Warenausgang.');
          }
          change=sql`stand='abgeschlossen',abschluss_art=${input.kind},abschluss_notiz=${input.note},abgeschlossen_am=statement_timestamp(),abgeschlossen_von=${auth.userId}::uuid`;
        }
        const updated=await tx.execute(sql`UPDATE public.v_complaint_rework_context_v1 SET ${change},version=version+1 WHERE tenant_id=${auth.tenantId} AND complaint_id=${before.complaint_id} AND version=${input.version} RETURNING complaint_id`);
        if(updated.length!==1)reject('CONFLICT','Reklamation wurde inzwischen geändert · nichts gespeichert.');
        after=await context(tx,auth.tenantId,before.complaint_id);
      }
      const receipt:Success['receipt']={complaintId:after.complaint_id,number:after.nummer,state:after.stand,version:after.version,eventId:randomUUID()};
      const payload={complaintId:after.complaint_id,action:input.action,requestHash,before,after,receipt,...(input.action==='wieder_oeffnen'?{reason:input.reason}:{})};
      await tx.execute(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,notes,payload,status,user_id,client_event_id,event_schema_version,correlation_id,aggregate_version,created_at)
        VALUES(${receipt.eventId},${auth.tenantId},${after.source_order_id},'COMPLAINT_CHANGED_V1',${'Reklamation '+after.nummer+' · '+after.stand},${input.action==='wieder_oeffnen'?input.reason:null},${JSON.stringify(payload)}::jsonb,'success',${auth.userId}::uuid,${input.clientKey}::uuid,1,${input.clientKey}::uuid,${after.version},statement_timestamp())`);
      return {code:'OK',receipt,replayed:false};
    });
  } catch(error) {
    console.error('[COMPLAINT_COMMAND_FAILED]',error instanceof Error?error.message:error);
    return error instanceof Rejected?error.result:{code:'UNAVAILABLE',message:'Nicht gespeichert · alle Eingaben sind noch da. Fehlercode: COMPLAINT_COMMAND_FAILED.'};
  }
}
