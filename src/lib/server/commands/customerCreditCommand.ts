import 'server-only';
import {randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import type {ImmutableInvoiceCancellationReceipt} from './immutableInvoiceCommand';

type CancellationIdentity=Pick<ImmutableInvoiceCancellationReceipt,'invoiceId'|'eventId'|'clientEventId'|'cancelledBy'>;

/** The original cancellation and its retained payment are the retry source.
 * A normal task key without a cancellation is unrelated, not a failed credit. */
export async function readCancellationCreditSource(tx:PrivilegedTenantTransaction,tenantId:string,key:string){
 const rows=await tx.execute<{invoice_id:string;invoice_number:string;order_id:string;customer_id:string;event_id:string;actor_id:string;paid_cents:string;entry_id:string|null;entry_amount:string|null;entry_actor:string|null;entry_key:string|null}>(sql`
  SELECT invoice.id::text AS invoice_id,invoice.invoice_number,invoice.order_id,invoice.customer_id,
   receipt.event_id,receipt.actor_id::text,invoice.payment_paid_amount_cents::text AS paid_cents,
   entry.id::text AS entry_id,entry.amount_cents::text AS entry_amount,
   entry.actor_user_id::text AS entry_actor,entry.idempotency_key AS entry_key
  FROM private.v_invoice_receipt_v1 receipt JOIN public.invoices invoice
   ON invoice.tenant_id=receipt.tenant_id AND invoice.id=receipt.invoice_id
   AND invoice.cancel_event_id=receipt.event_id AND invoice.cancel_client_event_id=receipt.client_event_id
  LEFT JOIN public.customer_credit_entries entry ON entry.tenant_id=invoice.tenant_id
   AND entry.invoice_id=invoice.id AND entry.kind='storno_gutschrift'
  WHERE receipt.tenant_id=${tenantId} AND receipt.client_event_id=${key}::uuid
   AND receipt.event_type='INVOICE_CANCELLED_V1' AND receipt.integrity_ok AND invoice.status='cancelled'
 `);
 if(!rows.length){
  const exists=await tx.execute(sql`SELECT id FROM public.events WHERE tenant_id=${tenantId} AND client_event_id=${key}::uuid AND event_type='INVOICE_CANCELLED_V1' LIMIT 1`);
  if(exists.length)throw Error('CUSTOMER_CREDIT_CANCELLATION_SOURCE_INCOMPLETE');
  return null;
 }
 const row=rows[0];
 if(rows.length!==1||!row.customer_id||row.paid_cents===null||!/^\d+$/.test(row.paid_cents)||!Number.isSafeInteger(Number(row.paid_cents)))throw Error('CUSTOMER_CREDIT_RETRY_SOURCE_INVALID');
 const amount=Number(row.paid_cents);
 if(row.entry_id&&(amount===0||row.entry_amount!==row.paid_cents||row.entry_actor!==row.actor_id||row.entry_key!==key))throw Error('CUSTOMER_CREDIT_RETRY_RECEIPT_CHANGED');
 return {invoiceId:row.invoice_id,invoiceNumber:row.invoice_number,orderId:row.order_id,customerId:row.customer_id,eventId:row.event_id,clientEventId:key,cancelledBy:row.actor_id,paidAmountCents:amount,pending:amount>0&&!row.entry_id};
}

/** Source is the immutable cancellation receipt; no caller-supplied credit amount. */
export async function appendCancellationCredit(tx:PrivilegedTenantTransaction,tenantId:string,receipt:CancellationIdentity):Promise<void>{
 const source=await readCancellationCreditSource(tx,tenantId,receipt.clientEventId);
 if(!source||source.invoiceId!==receipt.invoiceId||source.eventId!==receipt.eventId||source.cancelledBy!==receipt.cancelledBy)throw Error('CUSTOMER_CREDIT_CANCEL_SOURCE_INVALID');
 const amount=source.paidAmountCents;
 if(!source.pending)return;
 await tx.execute(sql`SELECT private.lock_customer_credit_v1(${tenantId},${source.customerId})`);
 await tx.execute(sql`
  INSERT INTO public.customer_credit_entries(id,tenant_id,customer_id,kind,amount_cents,invoice_id,actor_user_id,idempotency_key)
  VALUES(${randomUUID()}::uuid,${tenantId},${source.customerId},'storno_gutschrift',${amount},${receipt.invoiceId}::uuid,${receipt.cancelledBy}::uuid,${receipt.clientEventId})
  ON CONFLICT(tenant_id,idempotency_key) DO NOTHING
 `);
 const rows=await tx.execute<{kind:string;customer_id:string;amount_cents:string;invoice_id:string;actor_id:string}>(sql`
  SELECT kind,customer_id,amount_cents::text,invoice_id::text,actor_user_id::text AS actor_id
  FROM public.customer_credit_entries WHERE tenant_id=${tenantId} AND idempotency_key=${receipt.clientEventId}
 `);
 const entry=rows[0];
 if(rows.length!==1||!entry||entry.kind!=='storno_gutschrift'||entry.customer_id!==source.customerId||entry.amount_cents!==String(amount)||entry.invoice_id!==receipt.invoiceId||entry.actor_id!==receipt.cancelledBy)throw Error('CUSTOMER_CREDIT_CANCEL_RECEIPT_MISSING');
 // Check the deferred source inside the native savepoint, so its error cannot
 // escape at outer COMMIT and roll back the real cancellation.
 await tx.execute(sql`SET CONSTRAINTS customer_credit_source_guard IMMEDIATE`);
 await tx.execute(sql`SET CONSTRAINTS customer_credit_source_guard DEFERRED`);
}

/** Called after the ordinary TaskWriter has checked this task's authority. */
export async function repairCancellationCreditTask(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,task:{client_key:string;bezug_typ:string;bezug_id:string|null;erstellt_von:string}){
 const source=await readCancellationCreditSource(tx,auth.tenantId,task.client_key);if(!source)return;
 if(task.bezug_typ!=='auftrag'||task.bezug_id!==source.orderId||task.erstellt_von!==source.cancelledBy)throw Error('CUSTOMER_CREDIT_TASK_SOURCE_CHANGED');
 if(source.pending)await appendCancellationCredit(tx,auth.tenantId,source);
 const proof=await readCancellationCreditSource(tx,auth.tenantId,task.client_key);
 if(!proof||proof.pending)throw Error('CUSTOMER_CREDIT_TASK_REPAIR_NOT_PROVEN');
}
