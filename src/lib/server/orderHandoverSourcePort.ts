import 'server-only';
import {sql} from 'drizzle-orm';
import type {PrivilegedTenantTransaction} from './privilegedDb';

import type {ManualHandoverReceipt} from '@/lib/domain/orderHandoverContract';
export type {ManualHandoverReceipt} from '@/lib/domain/orderHandoverContract';

export async function readManualHandoverSource(tx:PrivilegedTenantTransaction,tenantId:string,eventId:string){
 const rows=await tx.execute<{event_id:string;tenant_id:string;order_id:string;actor_id:string;client_event_id:string;
  order_version:number;current_order_version:number;current_handover_mode:'pickup'|'shipping';integrity_ok:boolean;
  payload:{requestHash:string;before:{handoverMode:'pickup'|'shipping'};receipt:ManualHandoverReceipt}}>(sql`
  SELECT * FROM private.v_order_handover_manual_source_v1 WHERE tenant_id=${tenantId} AND event_id=${eventId}`);
 if(rows.length!==1||!rows[0].integrity_ok)throw Error('ORDER_MANUAL_HANDOVER_SOURCE_INVALID');
 return rows[0];
}

/** The task reference is the immutable command key, not an invented mail item. */
export async function readManualHandoverReceipt(tx:PrivilegedTenantTransaction,tenantId:string,eventId:string){
 const source=await readManualHandoverSource(tx,tenantId,eventId),receipt=source.payload.receipt;
 if(receipt.outcome==='changed')return {...receipt,taskId:null};
 const tasks=await tx.execute<{id:string}>(sql`SELECT id::text FROM public.tasks
  WHERE tenant_id=${tenantId} AND id=${source.event_id}::uuid AND client_key=${source.client_event_id}::uuid
    AND art='rueckruf' AND bezug_typ='auftrag' AND bezug_id=${source.order_id} AND erstellt_von=${source.actor_id}::uuid`);
 if(tasks.length!==1)throw Error('ORDER_MANUAL_HANDOVER_TASK_MISSING');
 return {...receipt,taskId:tasks[0].id};
}
