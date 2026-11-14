import 'server-only';
import {createHash} from 'node:crypto';
import {sql} from 'drizzle-orm';
import {canChangeEvidenceVisibility,type AuthorizationSnapshot} from './authorization';
import type {PrivilegedTenantTransaction} from './privilegedDb';
import {changeEvidenceVisibilityInTransaction} from './evidenceVisibilityCommand';
import {EVIDENCE_VISIBILITY_COPY as copy} from '@/ui/situationCatalog';
import type {TaskReference} from '@/modules/tasks/public';
import {mapEvidenceVisibility,type EvidenceVisibilityRow,type EvidenceVisibility} from '@/lib/domain/evidenceVisibility';

type UploadSource={evidenceKey:string;sourceKind:string;actorId:string;requestId:string;name:string;reference:TaskReference;visibility:EvidenceVisibility};
function intentId(tenant:string,key:string){
 const bytes=createHash('sha256').update(JSON.stringify(['evidence-visibility-upload',tenant,key])).digest().subarray(0,16);
 bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
 const h=bytes.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

/** Qualification reads the same secured original, never a replacement file. */
async function readUploadSource(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,key:string):Promise<UploadSource>{
 const rows=await tx.execute<EvidenceVisibilityRow&{evidence_key:string;source_kind:string;integrity_ok:boolean;target_links:unknown;actor:string|null;request:string|null;name:string|null;intake_item_id:string|null}>(sql`
  SELECT original.evidence_key,original.source_kind,original.integrity_ok,original.target_links,
   original.customer_visible,original.visibility_version,original.visibility_event_id,original.visibility_actor_id,original.visibility_occurred_at,
   CASE WHEN original.source_kind='LEGACY_SCAN_UPLOAD' THEN scan.uploaded_by::text
    WHEN original.source_kind='INTAKE_FILE' THEN file.aufgenommen_von::text ELSE evidence.actor_id::text END AS actor,
   CASE WHEN original.source_kind='LEGACY_SCAN_UPLOAD' THEN scan.client_idempotency_key::text
    WHEN original.source_kind='INTAKE_FILE' THEN file.id::text ELSE reservation.client_request_id::text END AS request,
   CASE WHEN original.source_kind='LEGACY_SCAN_UPLOAD' THEN scan.original_storage_path
    WHEN original.source_kind='INTAKE_FILE' THEN file.dateiname ELSE reservation.object_path END AS name,
   file.item_id::text AS intake_item_id
  FROM private.v_evidence_records_v3 original
  LEFT JOIN public.scan_uploads scan ON original.source_kind='LEGACY_SCAN_UPLOAD' AND scan.tenant_id=original.tenant_id AND scan.id::text=original.source_id
  LEFT JOIN private.order_station_evidence evidence ON original.source_kind IN ('ORDER_STATION_ATTACHMENT','ORDER_INTAKE_ATTACHMENT') AND evidence.tenant_id=original.tenant_id AND evidence.id::text=original.source_id
  LEFT JOIN private.order_station_evidence_reservations reservation ON reservation.tenant_id=evidence.tenant_id AND reservation.id=evidence.reservation_id
  LEFT JOIN public.intake_file file ON original.source_kind='INTAKE_FILE' AND file.tenant_id=original.tenant_id AND file.id::text=original.source_id
  WHERE original.tenant_id=${auth.tenantId} AND original.evidence_key=${key}`);
 const row=rows[0];
 if(rows.length!==1||!row||row.integrity_ok!==true||!row.actor||!row.request||!row.name||!Array.isArray(row.target_links))throw Error('EVIDENCE_UPLOAD_SOURCE_INVALID');
 const links=row.target_links as Array<{targetType:string;targetId:string}>;
 if(links.some(link=>!link||typeof link.targetType!=='string'||typeof link.targetId!=='string'))throw Error('EVIDENCE_UPLOAD_LINK_INVALID');
 const orders=links.filter(link=>link.targetType==='ORDER'),customers=links.filter(link=>link.targetType==='CUSTOMER');
 if(orders.length>1||customers.length>1)throw Error('EVIDENCE_UPLOAD_LINK_AMBIGUOUS');
 const reference:TaskReference=orders[0]?{type:'auftrag',id:orders[0].targetId}:customers[0]?{type:'kunde',id:customers[0].targetId}:
  row.intake_item_id?{type:'eingang',id:row.intake_item_id}:{type:'allgemein',id:null};
 return {evidenceKey:key,sourceKind:row.source_kind,actorId:row.actor,requestId:row.request,name:row.name,reference,visibility:mapEvidenceVisibility(row)};
}

export function readEvidenceUploadIntent(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,key:string){
 return readEvidenceVisibilityRetrySource(tx,auth,intentId(auth.tenantId,key));
}

/** One immutable provenance row for an upload; it is excluded from current flags. */
export async function recordEvidenceUploadIntent(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,key:string,requested:boolean){
 const source=await readUploadSource(tx,auth,key);
 if(source.actorId!==auth.userId||!canChangeEvidenceVisibility(auth,source.sourceKind))throw Error('EVIDENCE_UPLOAD_ORIGINAL_ACTOR_REQUIRED');
 if(source.reference.type==='auftrag')await tx.execute(sql`SELECT id FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=${source.reference.id} FOR UPDATE`);
 const id=intentId(auth.tenantId,key);
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${'evidence-upload-intent:'+auth.tenantId+':'+key},0))`);
 const previous=await readEvidenceVisibilityRetrySource(tx,auth,id);
 if(previous){if(previous.requested!==requested||previous.actorId!==auth.userId)throw Error('EVIDENCE_UPLOAD_INTENT_CONFLICT');return previous;}
 const saved=await tx.execute<{id:string}>(sql`INSERT INTO private.evidence_visibility_events
  (id,tenant_id,evidence_key,version,customer_visible,actor_id,client_event_id,record_kind,requested_visible)
  VALUES(${id}::uuid,${auth.tenantId},${key},0,false,${auth.userId}::uuid,${source.requestId}::uuid,'upload_intent',${requested}) RETURNING id::text`);
 if(saved.length!==1||saved[0].id!==id)throw Error('EVIDENCE_UPLOAD_INTENT_NOT_SAVED');
 const receipt=await readEvidenceVisibilityRetrySource(tx,auth,id);
 if(!receipt||receipt.actorId!==auth.userId||receipt.requested!==requested)throw Error('EVIDENCE_UPLOAD_INTENT_RECEIPT_INVALID');
 return receipt;
}

export async function readEvidenceVisibilityRetrySource(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string){
 const rows=await tx.execute<{id:string;evidence_key:string;actor_id:string;client_event_id:string;requested_visible:boolean;pending:boolean}>(sql`
  SELECT intent.id::text,intent.evidence_key,intent.actor_id::text,intent.client_event_id::text,intent.requested_visible,
   intent.requested_visible AND NOT EXISTS(SELECT 1 FROM private.evidence_visibility_events changed
    WHERE changed.tenant_id=intent.tenant_id AND changed.evidence_key=intent.evidence_key AND changed.record_kind='change' AND changed.version>0 AND changed.customer_visible=true) AS pending
  FROM private.evidence_visibility_events intent WHERE intent.tenant_id=${auth.tenantId} AND intent.id=${id}::uuid AND intent.record_kind='upload_intent'`);
 if(!rows.length)return null;
 const row=rows[0],source=await readUploadSource(tx,auth,row.evidence_key);
 if(rows.length!==1||intentId(auth.tenantId,row.evidence_key)!==id||source.actorId!==row.actor_id||source.requestId!==row.client_event_id
  ||typeof row.requested_visible!=='boolean'||typeof row.pending!=='boolean')throw Error('EVIDENCE_UPLOAD_INTENT_SOURCE_CHANGED');
 return {...source,markerId:id,requested:row.requested_visible,pending:row.pending,title:copy.retryTask(source.name),description:copy.retryTask(source.name)};
}

/** Called within the normal task completion transaction, after its own rights gate. */
export async function repairEvidenceVisibilityTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,task:{client_key:string;bezug_typ:string;bezug_id:string|null;erstellt_von:string}){
 const source=await readEvidenceVisibilityRetrySource(tx,auth,task.client_key);if(!source)return;
 if(task.erstellt_von!==source.actorId||task.bezug_typ!==source.reference.type||task.bezug_id!==source.reference.id)throw Error('EVIDENCE_VISIBILITY_TASK_SOURCE_CHANGED');
 if(source.pending){
  const result=await changeEvidenceVisibilityInTransaction(tx,auth,{evidenceKey:source.evidenceKey,customerVisible:source.requested,expectedVersion:0,clientEventId:source.markerId});
  if(result.code!=='OK')throw Error('EVIDENCE_VISIBILITY_TASK_REPAIR_'+result.code);
 }
 const proof=await readEvidenceVisibilityRetrySource(tx,auth,task.client_key);
 if(!proof||proof.pending)throw Error('EVIDENCE_VISIBILITY_TASK_REPAIR_NOT_PROVEN');
}
