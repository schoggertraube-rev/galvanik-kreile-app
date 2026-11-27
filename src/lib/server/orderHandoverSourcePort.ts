import 'server-only';
import {sql} from 'drizzle-orm';
import type {PrivilegedTenantTransaction} from './privilegedDb';

import type {ManualHandoverReceipt} from '@/lib/domain/orderHandoverContract';
export type {ManualHandoverReceipt} from '@/lib/domain/orderHandoverContract';

export type HandoverPreferenceBefore={clientEventId:string;mode:'pickup'|'shipping'|null};

async function readQualifiedHandoverSource<R extends {outcome:'changed'|'call_customer';handoverMode:'pickup'|'shipping'}>(tx:PrivilegedTenantTransaction,tenantId:string,eventId:string,manualOnly:boolean){
 const rows=await tx.execute<{event_id:string;tenant_id:string;order_id:string;actor_id:string;client_event_id:string;
  order_version:number;current_order_version:number;current_handover_mode:'pickup'|'shipping';integrity_ok:boolean;
  payload:{requestHash:string;before:{handoverMode:'pickup'|'shipping';preference?:HandoverPreferenceBefore};receipt:R}}>(sql`
  SELECT * FROM private.v_order_handover_manual_source_v1 WHERE tenant_id=${tenantId} AND event_id=${eventId}
   ${manualOnly?sql`AND payload#>>'{receipt,actor,kind}'='login'`:sql``}`);
 if(rows.length!==1||!rows[0].integrity_ok)throw Error('ORDER_HANDOVER_SOURCE_INVALID');
 return rows[0];
}
export function readManualHandoverSource(tx:PrivilegedTenantTransaction,tenantId:string,eventId:string){
 return readQualifiedHandoverSource<ManualHandoverReceipt>(tx,tenantId,eventId,true);
}
/** The existing immutable source qualifies both login and original-MIME branches. */
export function readInvoiceHandoverSource(tx:PrivilegedTenantTransaction,tenantId:string,eventId:string){
 return readQualifiedHandoverSource<Pick<ManualHandoverReceipt,'outcome'|'handoverMode'>>(tx,tenantId,eventId,false);
}

type MailHandoverReceipt=Pick<ManualHandoverReceipt,'orderId'|'customerId'|'outcome'|'handoverMode'|'requestedHandoverMode'>&{
 taskId:string|null;
};

export async function readAssignedMailHandoverSource(tx:PrivilegedTenantTransaction,tenantId:string,input:{itemId:string;customerId:string;orderId:string}){
 const applied=await tx.execute<{befehl_id:string;von:string;action:string;task_id:string|null}>(sql`
  SELECT effect.befehl_id::text,effect.von,effect.nachher->>'action' AS action,effect.nachher->>'taskId' AS task_id
  FROM public.intake_event effect
  WHERE effect.tenant_id=${tenantId} AND effect.item_id=${input.itemId}::uuid AND effect.art='anliegen'
   AND effect.nachher->>'customerId'=${input.customerId} AND effect.nachher->>'orderId'=${input.orderId}
   AND effect.nachher->>'action' IN ('auftrag.uebergabe_geaendert','auftrag.uebergabe_klaeren')
   AND NOT EXISTS(SELECT 1 FROM public.intake_event newer
    WHERE newer.tenant_id=effect.tenant_id AND newer.item_id=effect.item_id
     AND newer.art IN ('zugeordnet','umgehaengt','zurueckgenommen') AND newer.zeit>=effect.zeit) LIMIT 2`);
 if(!applied.length)return null;
 if(applied.length!==1)throw Error('ORDER_HANDOVER_SOURCE_INVALID');
 const [effect]=applied;
 const events=await tx.execute<{id:string}>(sql`SELECT id FROM public.events
  WHERE tenant_id=${tenantId} AND order_id=${input.orderId} AND event_type='ORDER_HANDOVER_MAIL_V1'
   AND client_event_id=${effect.befehl_id}::uuid AND user_id=${effect.von}::uuid
   AND payload#>>'{receipt,mailActor,originalItemId}'=${input.itemId} LIMIT 2`);
 if(events.length!==1)throw Error('ORDER_HANDOVER_SOURCE_INVALID');
 const source=await readQualifiedHandoverSource<MailHandoverReceipt>(tx,tenantId,events[0].id,false);
 const {receipt}=source.payload;
 if(receipt.taskId!==effect.task_id||
   (receipt.outcome==='call_customer')!==(effect.action==='auftrag.uebergabe_klaeren')||
   (receipt.outcome==='call_customer')!==Boolean(receipt.taskId))throw Error('ORDER_HANDOVER_SOURCE_INVALID');
 return source;
}

export async function readPreviousMailHandoverPreference(tx:PrivilegedTenantTransaction,tenantId:string,input:{
 customerId:string;actorId:string;clientEventId:string;mode:'pickup'|'shipping';
 recordedBefore?:HandoverPreferenceBefore;
}):Promise<{mode:'pickup'|'shipping'|null}|null>{
 const prior=input.recordedBefore;
 const hasPrior=prior?.clientEventId===input.clientEventId&&(prior.mode===null||prior.mode==='pickup'||prior.mode==='shipping');
 const [previous]=await tx.execute<{mode:string|null;kind:string}>(sql`
  WITH original AS (
   SELECT change.aggregate_version,change.payload#>'{fields,handover_preference}' AS preference
   FROM public.events change
   WHERE change.tenant_id=${tenantId} AND change.event_type='CUSTOMER_UPDATED_V1' AND change.status='success'
    AND change.event_schema_version=1 AND change.client_event_id=${input.clientEventId}::uuid
    AND change.user_id=${input.actorId}::uuid AND change.payload->>'customerId'=${input.customerId}
    AND change.payload#>>'{fields,handover_preference}'=${input.mode}
  ), previous AS (
   SELECT change.aggregate_version,change.payload#>'{fields,handover_preference}' AS preference
   FROM public.events change CROSS JOIN original
   WHERE change.tenant_id=${tenantId} AND change.event_type='CUSTOMER_UPDATED_V1' AND change.status='success'
    AND change.event_schema_version=1 AND change.payload->>'customerId'=${input.customerId}
    AND change.aggregate_version<original.aggregate_version AND (change.payload->'fields') ? 'handover_preference'
   UNION ALL
   SELECT original.aggregate_version,${JSON.stringify(hasPrior?prior.mode:null)}::jsonb FROM original WHERE ${hasPrior}::boolean
   UNION ALL
   SELECT 0,created.customer_fields->'handover_preference'
   FROM private.customer_create_receipts created
   JOIN private.v_customer_create_receipts_v1 proof ON proof.tenant_id=created.tenant_id AND proof.receipt_id=created.id AND proof.integrity_ok
   WHERE created.tenant_id=${tenantId} AND created.customer_id=${input.customerId}
    AND created.customer_fields ? 'handover_preference'
  )
  SELECT previous.preference#>>'{}' AS mode,jsonb_typeof(previous.preference) AS kind
  FROM previous CROSS JOIN original
  WHERE NOT EXISTS(SELECT 1 FROM public.events newer
   WHERE newer.tenant_id=${tenantId} AND newer.event_type='CUSTOMER_UPDATED_V1' AND newer.status='success'
    AND newer.payload->>'customerId'=${input.customerId} AND newer.aggregate_version>original.aggregate_version
    AND (newer.payload->'fields') ? 'handover_preference'
    AND newer.payload#>'{fields,handover_preference}' IS DISTINCT FROM original.preference)
  ORDER BY previous.aggregate_version DESC LIMIT 1`);
 if(previous?.kind==='null')return {mode:null};
 if(previous?.mode==='pickup'||previous?.mode==='shipping')return {mode:previous.mode};
 return null;
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
