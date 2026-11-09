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
 * The dedicated H3 Replay test exercises the actual ITEM writer and Storage instead.
 */
export async function seedSyntheticItemPhotos(db:ReturnType<typeof postgres>,input:{tenantId:string;actorId:string;orderId:string}):Promise<void>{
 const items=await db<{id:string;customer_id:string}[]>`SELECT item.id,item.customer_id FROM public.items item WHERE item.tenant_id=${input.tenantId} AND item.order_id=${input.orderId}
  AND NOT EXISTS(SELECT 1 FROM public.scan_uploads photo WHERE photo.tenant_id=item.tenant_id AND photo.linked_order_id=item.order_id AND item.photo_ids ? photo.id::text AND photo.status='secured' AND photo.file_type='image/png')`;
 for(const item of items){
  const ids=await seedSyntheticComplaintPhoto(db,{...input,customerId:item.customer_id});
  await db`UPDATE public.items SET photo_ids=coalesce(photo_ids,'[]'::jsonb)||${db.json(ids)} WHERE tenant_id=${input.tenantId} AND order_id=${input.orderId} AND id=${item.id}`;
 }
}
