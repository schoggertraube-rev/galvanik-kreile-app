import 'server-only';
import {randomUUID} from 'node:crypto';
import {sql} from 'drizzle-orm';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import type {ImmutableInvoiceCancellationReceipt} from './immutableInvoiceCommand';
import type {CustomerCreditApplyInput,CustomerCreditResult} from '@/modules/accounting/public';
import {confirmPayment,type ConfirmPaymentResult} from './confirmPaymentCommand';
import {CUSTOMER_CREDIT_COPY} from '@/ui/situationCatalog';
import {canonicalJson} from '@/lib/domain/canonicalJson';
import {hasAuthorizationArea,resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {CustomerCreditPayoutInput,CustomerCreditPayoutReceipt,CustomerCreditPayoutResult} from '@/modules/accounting/public';

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

type CreditReader=(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string)=>Promise<CustomerCreditResult>;

const creditUuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function isPayoutInput(value:unknown):value is CustomerCreditPayoutInput{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const row=value as CustomerCreditPayoutInput;
 if(Object.keys(row).sort().join(',')!=='amount,clientEventId,customerId,expectedCreditVersion,method,note,reference'||typeof row.customerId!=='string'||!row.customerId.length||row.customerId.length>128||row.customerId.trim()!==row.customerId||!creditUuid.test(row.clientEventId)||!Number.isSafeInteger(row.amount)||row.amount<=0||row.amount>2147483647||!Number.isSafeInteger(row.expectedCreditVersion)||row.expectedCreditVersion<0||row.expectedCreditVersion>2147483647||!['bar','ueberweisung'].includes(row.method))return false;
 if(row.note!==null&&(typeof row.note!=='string'||!row.note.trim()||row.note.trim()!==row.note))return false;
 if(row.reference===null)return row.method==='bar';
 const ref=row.reference;
 if(typeof ref!=='object'||Array.isArray(ref)||Object.keys(ref).sort().join(',')!=='date,purpose'||typeof ref.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(ref.date)||typeof ref.purpose!=='string'||!ref.purpose.trim()||ref.purpose.trim()!==ref.purpose)return false;
 const date=new Date(ref.date+'T00:00:00.000Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===ref.date;
}

/** S08b uses the same append-only ledger and balance reader. Reference date and
 * purpose are stored losslessly as canonical JSON in the approved text field;
 * this is not a second payment or turnover writer. */
export async function payoutCustomerCredit(input:unknown,readCredit:CreditReader,readCustomer:(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string)=>Promise<{id:string;name:string}|null>):Promise<CustomerCreditPayoutResult>{
 try{
  const authorization=await resolveAuthorization();
  if(!authorization.ok)return {code:authorization.reason==='AUTHORIZATION_UNAVAILABLE'?'UNAVAILABLE':'UNAUTHENTICATED',message:CUSTOMER_CREDIT_COPY.unavailable};
  const auth=authorization.data;
  if(!hasAuthorizationArea(auth,'geld'))return {code:'FORBIDDEN',message:CUSTOMER_CREDIT_COPY.payoutForbidden};
  if(!input||typeof input!=='object'||!('method'in input)||!['bar','ueberweisung'].includes(String(input.method)))return {code:'VALIDATION_ERROR',message:CUSTOMER_CREDIT_COPY.payoutMethodMissing};
  if(input.method==='ueberweisung'&&(!('reference'in input)||!input.reference))return {code:'VALIDATION_ERROR',message:CUSTOMER_CREDIT_COPY.payoutReferenceMissing};
  if(!isPayoutInput(input))return {code:'VALIDATION_ERROR',message:CUSTOMER_CREDIT_COPY.payoutInvalid};
  const reference=input.reference===null?null:canonicalJson(input.reference),intent=canonicalJson(input);
  return await withPrivilegedTenantTransaction(auth,async tx=>{
   await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('customer-credit:payout:'||${auth.tenantId}||':'||${input.clientEventId},0))`);
   await tx.execute(sql`SELECT private.lock_customer_credit_v1(${auth.tenantId},${input.customerId})`);
   const readReceipt=async()=>{
    const rows=await tx.execute<{id:string;event_type:string;actor_id:string;payload:unknown;description:string;entry_id:string|null;entry_customer:string|null;entry_amount:string|null;entry_actor:string|null;entry_method:string|null;entry_reference:string|null;entry_note:string|null}>(sql`
     SELECT event.id,event.event_type,event.user_id::text AS actor_id,event.payload,event.description,
      entry.id::text AS entry_id,entry.customer_id AS entry_customer,entry.amount_cents::text AS entry_amount,
      entry.actor_user_id::text AS entry_actor,entry.payment_method AS entry_method,entry.reference AS entry_reference,entry.note AS entry_note
     FROM public.events event LEFT JOIN public.customer_credit_entries entry ON entry.tenant_id=event.tenant_id
      AND entry.idempotency_key=event.client_event_id::text AND entry.kind='auszahlung'
     WHERE event.tenant_id=${auth.tenantId} AND event.client_event_id=${input.clientEventId}::uuid
    `);
    if(!rows.length)return null;
    if(rows.length!==1)throw Error('CUSTOMER_CREDIT_PAYOUT_AMBIGUOUS');
    const row=rows[0];
    if(row.event_type!=='CUSTOMER_CREDIT_PAYOUT_V1'||row.actor_id!==auth.userId)return 'CONFLICT' as const;
    const payload=row.payload as {intent?:unknown;creditEntryId?:string;customerId?:string;amountCents?:number;method?:string;reference?:string|null;receipt?:CustomerCreditPayoutReceipt};
    if(!payload||payload.intent!==intent)return 'CONFLICT' as const;
    const receipt=payload.receipt;
    if(payload.creditEntryId!==row.entry_id||payload.customerId!==input.customerId||payload.amountCents!==input.amount||payload.method!==input.method||payload.reference!==reference)throw Error('CUSTOMER_CREDIT_PAYOUT_SOURCE_CHANGED');
    if(!receipt||receipt.eventId!==row.id||!creditUuid.test(receipt.eventId)||receipt.creditEntryId!==row.entry_id||receipt.customerId!==input.customerId||receipt.customerId!==row.entry_customer||receipt.clientEventId!==input.clientEventId||receipt.amountCents!==input.amount||String(-receipt.amountCents)!==row.entry_amount||receipt.method!==input.method||receipt.method!==row.entry_method||receipt.reference!==reference||receipt.reference!==row.entry_reference||receipt.note!==input.note||receipt.note!==row.entry_note||receipt.actorId!==auth.userId||receipt.actorId!==row.entry_actor||receipt.description!==row.description||!Number.isSafeInteger(receipt.balanceCents)||receipt.balanceCents<0||receipt.creditVersion!==input.expectedCreditVersion+1||!Number.isFinite(Date.parse(receipt.occurredAt)))throw Error('CUSTOMER_CREDIT_PAYOUT_RECEIPT_INVALID');
    return receipt;
   };
   const existing=await readReceipt();
   if(existing==='CONFLICT')return {code:'CONFLICT',message:CUSTOMER_CREDIT_COPY.payoutChanged};
   if(existing)return {code:'OK',receipt:existing,replayed:true};
   const customer=await readCustomer(tx,auth.tenantId,input.customerId);
   if(!customer)return {code:'NOT_FOUND',message:CUSTOMER_CREDIT_COPY.notFound};
   const balance=await readCredit(tx,auth.tenantId,input.customerId);if(balance.code!=='OK')return balance;
   if(balance.credit.version!==input.expectedCreditVersion||input.amount>balance.credit.balanceCents)return {code:'CONFLICT',message:CUSTOMER_CREDIT_COPY.payoutChanged,currentCreditBalanceCents:balance.credit.balanceCents};
   const clock=await tx.execute<{at:string}>(sql`SELECT to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at`);
   if(clock.length!==1||!Number.isFinite(Date.parse(clock[0].at)))throw Error('CUSTOMER_CREDIT_PAYOUT_CLOCK_MISSING');
   const receipt:CustomerCreditPayoutReceipt={eventId:randomUUID(),creditEntryId:randomUUID(),customerId:input.customerId,clientEventId:input.clientEventId,amountCents:input.amount,balanceCents:balance.credit.balanceCents-input.amount,creditVersion:balance.credit.version+1,method:input.method,reference,note:input.note,actorId:auth.userId,occurredAt:clock[0].at,description:CUSTOMER_CREDIT_COPY.payoutLabel((input.amount/100).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €',customer.name,input.method)};
   const event=await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,user_id,payload,status,client_event_id,event_schema_version,created_at)
    VALUES(${receipt.eventId},${auth.tenantId},'CUSTOMER_CREDIT_PAYOUT_V1',${receipt.description},${auth.userId}::uuid,
     ${JSON.stringify({creditEntryId:receipt.creditEntryId,customerId:input.customerId,amountCents:input.amount,method:input.method,reference,intent,receipt})}::jsonb,
     'success',${input.clientEventId}::uuid,1,${receipt.occurredAt}::timestamptz AT TIME ZONE 'UTC') RETURNING id`);
   if(event.length!==1)throw Error('CUSTOMER_CREDIT_PAYOUT_EVENT_MISSING');
   const entry=await tx.execute(sql`INSERT INTO public.customer_credit_entries(id,tenant_id,customer_id,kind,amount_cents,payment_method,reference,note,actor_user_id,idempotency_key)
    VALUES(${receipt.creditEntryId}::uuid,${auth.tenantId},${input.customerId},'auszahlung',${-input.amount},${input.method},${reference},${input.note},${auth.userId}::uuid,${input.clientEventId}) RETURNING id`);
   if(entry.length!==1)throw Error('CUSTOMER_CREDIT_PAYOUT_ENTRY_MISSING');
   await tx.execute(sql`SET CONSTRAINTS customer_credit_source_guard IMMEDIATE`);
   await tx.execute(sql`SET CONSTRAINTS customer_credit_source_guard DEFERRED`);
   const persisted=await readReceipt();if(!persisted||persisted==='CONFLICT'||canonicalJson(persisted)!==canonicalJson(receipt))throw Error('CUSTOMER_CREDIT_PAYOUT_NOT_PROVEN');
   return {code:'OK',receipt:persisted,replayed:false};
  });
 }catch(error){console.error('[CUSTOMER_CREDIT_PAYOUT_FAILED]',{message:error instanceof Error?error.message.slice(0,160):'UNKNOWN'});return {code:'UNAVAILABLE',message:CUSTOMER_CREDIT_COPY.unavailable};}
}

/** No second payment writer: the ordinary command owns event, aggregate,
 * ledger debit, locks and their one transaction/receipt. */
export async function applyCustomerCredit(input:unknown,readCredit:CreditReader):Promise<ConfirmPaymentResult>{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='amount,clientEventId,expectedCreditVersion,expectedOpenAmountCents,expectedVersion,invoiceId')return {code:'VALIDATION_ERROR',message:CUSTOMER_CREDIT_COPY.invalid};
 const value=input as CustomerCreditApplyInput;
 if(!Number.isSafeInteger(value.expectedCreditVersion)||value.expectedCreditVersion<0||value.expectedCreditVersion>2147483647||!Number.isSafeInteger(value.expectedOpenAmountCents)||value.expectedOpenAmountCents<0)return {code:'VALIDATION_ERROR',message:CUSTOMER_CREDIT_COPY.invalid};
 const {expectedCreditVersion,...payment}=value;
 return confirmPayment({...payment,method:'guthaben'},{expectedVersion:expectedCreditVersion,
  prepare:async(tx,auth,request)=>{
   const rows=await tx.execute<{customer_id:string|null}>(sql`SELECT customer_id FROM public.invoices WHERE tenant_id=${auth.tenantId} AND id=${request.invoiceId}::uuid LIMIT 2`);
   if(rows.length!==1||!rows[0].customer_id)return {code:'NOT_FOUND',message:CUSTOMER_CREDIT_COPY.notFound};
   const customerId=rows[0].customer_id;
   await tx.execute(sql`SELECT private.lock_customer_credit_v1(${auth.tenantId},${customerId})`);
   const read=await readCredit(tx,auth.tenantId,customerId);if(read.code!=='OK')return read;
   if(read.credit.version!==expectedCreditVersion||request.amount>read.credit.balanceCents)return {code:'CONFLICT',message:CUSTOMER_CREDIT_COPY.changed,currentCreditBalanceCents:read.credit.balanceCents};
   return {code:'OK',customerId};
  },
  debit:async(tx,auth,request,customerId)=>{
   const rows=await tx.execute<{id:string}>(sql`INSERT INTO public.customer_credit_entries(id,tenant_id,customer_id,kind,amount_cents,invoice_id,actor_user_id,idempotency_key)
    VALUES(${randomUUID()}::uuid,${auth.tenantId},${customerId},'verrechnung',${-request.amount},${request.invoiceId}::uuid,${auth.userId}::uuid,${request.clientEventId}) RETURNING id::text`);
   if(rows.length!==1)throw Error('CUSTOMER_CREDIT_DEBIT_NOT_SAVED');
  },
  verify:async(tx,auth,receipt)=>{
   const rows=await tx.execute<{kind:string;amount_cents:string;actor_id:string;customer_id:string;invoice_customer_id:string;invoice_id:string}>(sql`
    SELECT entry.kind,entry.amount_cents::text,entry.actor_user_id::text AS actor_id,entry.customer_id,invoice.customer_id AS invoice_customer_id,entry.invoice_id::text
    FROM public.customer_credit_entries entry JOIN public.invoices invoice ON invoice.tenant_id=entry.tenant_id AND invoice.id=entry.invoice_id
    WHERE entry.tenant_id=${auth.tenantId} AND entry.idempotency_key=${receipt.clientEventId}
   `);
   const row=rows[0];
   if(rows.length!==1||!row||row.kind!=='verrechnung'||row.amount_cents!==String(-receipt.amountCents)||row.actor_id!==receipt.confirmedBy||row.invoice_id!==receipt.invoiceId||row.customer_id!==row.invoice_customer_id)throw Error('CUSTOMER_CREDIT_DEBIT_RECEIPT_MISSING');
   await tx.execute(sql`SET CONSTRAINTS customer_credit_source_guard,invoices_customer_credit_receipt_guard IMMEDIATE`);
   await tx.execute(sql`SET CONSTRAINTS customer_credit_source_guard,invoices_customer_credit_receipt_guard DEFERRED`);
  },
 });
}

/** Receipt projection composed by the root; accounting never reads foreign events. */
export async function readCustomerCreditPayoutHistory(tx:PrivilegedTenantTransaction,tenantId:string,customerId:string):Promise<CustomerCreditPayoutReceipt[]>{
    const rows=await tx.execute<{entry_id:string;amount_cents:string;actor_id:string;method:string;reference:string|null;note:string|null;event_id:string|null;description:string|null;event_actor:string|null;client_key:string;payload:unknown}>(sql`
     SELECT entry.id::text AS entry_id,entry.amount_cents::text,entry.actor_user_id::text AS actor_id,
      entry.payment_method AS method,entry.reference,entry.note,entry.idempotency_key AS client_key,
      event.id AS event_id,event.description,event.user_id::text AS event_actor,event.payload
     FROM public.customer_credit_entries entry LEFT JOIN public.events event ON event.tenant_id=entry.tenant_id
      AND event.client_event_id::text=entry.idempotency_key AND event.event_type='CUSTOMER_CREDIT_PAYOUT_V1'
     WHERE entry.tenant_id=${tenantId} AND entry.customer_id=${customerId} AND entry.kind='auszahlung'
     ORDER BY entry.created_at,entry.id
    `);
    const seen=new Set<string>();
    return rows.map(row=>{
     const payload=row.payload as {creditEntryId?:string;customerId?:string;amountCents?:number;method?:string;reference?:string|null;receipt?:CustomerCreditPayoutReceipt};
     const receipt=payload?.receipt;
     if(seen.has(row.entry_id)||!receipt||payload.creditEntryId!==row.entry_id||payload.customerId!==customerId||String(-Number(payload.amountCents))!==row.amount_cents||payload.method!==row.method||payload.reference!==row.reference||receipt.creditEntryId!==row.entry_id||receipt.eventId!==row.event_id||receipt.customerId!==customerId||receipt.clientEventId!==row.client_key||String(-receipt.amountCents)!==row.amount_cents||receipt.actorId!==row.actor_id||receipt.actorId!==row.event_actor||receipt.method!==row.method||receipt.reference!==row.reference||receipt.note!==row.note||receipt.description!==row.description||!Number.isFinite(Date.parse(receipt.occurredAt)))throw Error('CUSTOMER_CREDIT_PAYOUT_HISTORY_INCOMPLETE');
     seen.add(row.entry_id);return receipt;
    });
}
