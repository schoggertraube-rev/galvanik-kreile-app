import {randomUUID,createHash} from 'node:crypto';
import type postgres from 'postgres';

/** Isolated synthetic metadata fixture, not a storage-upload or browser proof. */
export async function seedSyntheticComplaintPhoto(db:ReturnType<typeof postgres>,input:{tenantId:string;actorId:string;customerId:string;orderId:string}):Promise<string[]>{
 const id=randomUUID(),hash=createHash('sha256').update('SYNTHETIC-COMPLAINT-PHOTO:'+id).digest('hex');
 await db`INSERT INTO public.scan_uploads(id,tenant_id,file_url,file_type,uploaded_by,status,linked_order_id,linked_customer_id,original_hash,original_storage_path,original_size_bytes,original_secured_at,client_idempotency_key)
 VALUES(${id},${input.tenantId},${'test://synthetic-complaint/'+id},'image/png',${input.actorId}::uuid,'secured',${input.orderId},${input.customerId},${hash},${'TEST/'+hash+'.png'},32,now(),${id})`;
 return [id];
}

/** Initial metadata for older freeze/payment fixtures, never an upload-path proof.
 * The dedicated H3 Replay test exercises the actual existing part-photo writer and Storage.
 */
export async function seedSyntheticItemPhotos(db:ReturnType<typeof postgres>,input:{tenantId:string;actorId:string;orderId:string}):Promise<void>{
 const items=await db<{id:string;customer_id:string}[]>`SELECT item.id,item.customer_id FROM public.items item WHERE item.tenant_id=${input.tenantId} AND item.order_id=${input.orderId}
  AND NOT EXISTS(SELECT 1 FROM private.evidence_domain_links link WHERE link.tenant_id=item.tenant_id AND link.target_type='ORDER_ITEM' AND link.target_id=item.id)`;
 const [transition]=await db<{id:string;aggregate_version:number}[]>`SELECT id,aggregate_version FROM public.events WHERE tenant_id=${input.tenantId} AND order_id=${input.orderId} AND event_type='ORDER_STATION_MOVED_V1' AND station='galvanik' ORDER BY aggregate_version DESC LIMIT 1`;
 if(!transition)throw Error('SYNTHETIC_ITEM_PHOTO_REQUIRES_REAL_HANDOFF');
 for(const item of items){
  const reservation=randomUUID(),evidence=randomUUID(),hash=createHash('sha256').update('SYNTHETIC-INITIAL-PART-PHOTO:'+evidence).digest('hex');
  await db`INSERT INTO private.order_station_evidence_reservations(id,tenant_id,customer_id,order_id,item_id,transition_event_id,order_version,actor_id,client_request_id,purpose,station,bucket_id,object_path,mime_type,file_bytes,content_sha256)
   VALUES(${reservation}::uuid,${input.tenantId},${item.customer_id},${input.orderId},${item.id},${transition.id},${transition.aggregate_version},${input.actorId}::uuid,${randomUUID()}::uuid,'GALVANIK_HANDOFF_ORIGINAL_V1','galvanik','item-photos',${'order-station-evidence/v1/'+reservation+'.png'},'image/png',32,${hash})`;
  await db`INSERT INTO private.order_station_evidence(id,reservation_id,tenant_id,actor_id,storage_object_id,storage_object_version,verified_mime_type,verified_file_bytes,verified_content_sha256,storage_created_at)
   VALUES(${evidence}::uuid,${reservation}::uuid,${input.tenantId},${input.actorId}::uuid,${randomUUID()}::uuid,'SYNTHETIC-INITIAL-METADATA','image/png',32,${hash},statement_timestamp())`;
  await db`INSERT INTO private.evidence_extraction_metadata(evidence_id,tenant_id,extraction_state) VALUES(${evidence}::uuid,${input.tenantId},'NOT_REQUESTED')`;
  await db`INSERT INTO private.evidence_domain_links(evidence_id,tenant_id,target_type,target_id) VALUES(${evidence}::uuid,${input.tenantId},'ORDER',${input.orderId}),(${evidence}::uuid,${input.tenantId},'ORDER_ITEM',${item.id})`;
 }
}
