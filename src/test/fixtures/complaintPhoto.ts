import {randomUUID,createHash} from 'node:crypto';
import type postgres from 'postgres';

/** Isolated synthetic metadata fixture, not a storage-upload or browser proof. */
export async function seedSyntheticComplaintPhoto(db:ReturnType<typeof postgres>,input:{tenantId:string;actorId:string;customerId:string;orderId:string}):Promise<string[]>{
 const id=randomUUID(),hash=createHash('sha256').update('SYNTHETIC-COMPLAINT-PHOTO:'+id).digest('hex');
 await db`INSERT INTO public.scan_uploads(id,tenant_id,file_url,file_type,uploaded_by,status,linked_order_id,linked_customer_id,original_hash,original_storage_path,original_size_bytes,original_secured_at,client_idempotency_key)
 VALUES(${id},${input.tenantId},${'test://synthetic-complaint/'+id},'image/png',${input.actorId}::uuid,'secured',${input.orderId},${input.customerId},${hash},${'TEST/'+hash+'.png'},32,now(),${id})`;
 return [id];
}
