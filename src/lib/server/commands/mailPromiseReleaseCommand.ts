import 'server-only';

import {sql} from 'drizzle-orm';
import {canChangeOrderHandover,hasAuthorizationArea} from '@/lib/auth/authorizationContract';
import {formatEuro} from '@/lib/domain/formatEuro';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {readOpenOrderComplaint} from '@/lib/server/orderReleaseRead';
import {readCustomerDeliveryBlockInTransaction,readMailPaymentReleaseInTransaction} from '@/lib/server/paymentSummaryRead';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {MAIL_PROMISE_COPY} from '@/ui/eingangMailCopy';
import {COMPLAINT_ORDER_COPY,SHIPPING_FEE_COPY} from '@/ui/situationCatalog';
import {readPendingInvoiceReissue} from './immutableInvoiceCommand';

export type ZusageGrund='unbekannt'|'recht'|'preisrecht'|'liefersperre'|'vorkasse'|'abholzahlung'|'reklamation'|'neuausstellung'|'termin'|
  'menge'|'kv_abgelaufen'|'kv_schon_auftrag'|'storno'|'stammdaten';
export type ZusageErgebnis={frei:true}|{
  frei:false;
  grund:ZusageGrund;
  text:string;
  ausweg?:{befehl:string;text:string};
  ausnahme?:{recht:'entscheiden'};
};

const unavailable={frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.unavailable} as const;

export async function pruefeHerausgabe(
  tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{customerId:string;orderId:string},lockInvoices=false,
):Promise<ZusageErgebnis>{
  const {customerId,orderId}=input;
  const debt=await readCustomerDeliveryBlockInTransaction(tx,auth,customerId,orderId,lockInvoices);
  if(debt.code!=='OK')return unavailable;
  const reissue=await readPendingInvoiceReissue(tx,auth.tenantId,orderId);
  if(reissue!==null)return {frei:false,grund:'neuausstellung',text:SHIPPING_FEE_COPY.reissueReleaseBlocked(reissue)};
  const complaint=await readOpenOrderComplaint(tx,auth.tenantId,orderId);
  if(complaint)return {frei:false,grund:'reklamation',text:COMPLAINT_ORDER_COPY.releaseBlocked(complaint.number)};

  const ausnahme=hasAuthorizationArea(auth,'entscheiden')?{ausnahme:{recht:'entscheiden' as const}}:{};
  if(debt.data.blocked){
    const invoice=debt.oldest;
    const text=invoice?MAIL_PROMISE_COPY.overdue(invoice.number,formatEuro(invoice.openAmountCents),invoice.daysOverdue):MAIL_PROMISE_COPY.overdueWithoutAmounts;
    return {frei:false,grund:'liefersperre',text,
      ...(invoice?{ausweg:{befehl:'confirmPaymentAction',text:MAIL_PROMISE_COPY.collectAtPickup(invoice.number)}}:{}),...ausnahme};
  }
  if(debt.paymentMode==='rechnung'||debt.paymentMode==='keiner')return {frei:true};
  if(!debt.handover)return unavailable;
  const payment=await readMailPaymentReleaseInTransaction(tx,auth,orderId);
  if(!payment||payment.mode!==debt.paymentMode)return unavailable;
  if(payment.paid)return payment.ready?{frei:true}:unavailable;
  const amount=payment.amount===null?null:formatEuro(payment.amount);
  const text=MAIL_PROMISE_COPY.prepayment(amount,debt.handover);
  return debt.paymentMode==='vorkasse'?{frei:false,grund:'vorkasse',text,...ausnahme}:{frei:false,grund:'abholzahlung',text};
}

type ZusageAusnahmeInput={customerId:string;orderId:string;expectedVersion:number;clientEventId:string;reason:string};
type ZusageAusnahmeResult=
  | {code:'OK';eventId:string;replayed:boolean}
  | {code:'FORBIDDEN'|'CONFLICT'|'UNAVAILABLE'|'VALIDATION_ERROR'};
const promiseExceptionType='MAIL_ZUSAGE_AUSNAHME_V1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The send composition supplies its own transaction and key. This records only the approved exception. */
export async function recordZusageAusnahmeInTransaction(
  tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:ZusageAusnahmeInput,
):Promise<ZusageAusnahmeResult>{
  if(!auth.active||!canChangeOrderHandover(auth,'mail')||!hasAuthorizationArea(auth,'entscheiden'))return {code:'FORBIDDEN'};
  const {orderId,customerId,expectedVersion,clientEventId,reason}=input;
  if(!uuid.test(clientEventId)||!orderId||!customerId||!Number.isSafeInteger(expectedVersion)||expectedVersion<1||
    typeof reason!=='string'||reason!==reason.trim()||reason.length<3||reason.length>2000)return {code:'VALIDATION_ERROR'};
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('mail-promise-exception:'||${auth.tenantId}||':'||${clientEventId},0))`);
  const prior=await tx.execute<{id:string;actor:string;orderId:string;version:number;kind:string;status:string;notes:string;payload:{customerId?:string;grund?:string}}>(sql`
    SELECT id,user_id::text AS actor,order_id AS "orderId",aggregate_version AS version,
      event_type AS kind,status,notes,payload
    FROM public.events WHERE tenant_id=${auth.tenantId} AND client_event_id=${clientEventId}::uuid LIMIT 2`);
  if(prior.length){
    const saved=prior[0];
    return prior.length===1&&saved.kind===promiseExceptionType&&saved.status==='success'&&saved.actor===auth.userId&&
      saved.orderId===orderId&&saved.version===expectedVersion&&saved.notes===reason&&saved.payload.customerId===customerId&&
      (saved.payload.grund==='liefersperre'||saved.payload.grund==='vorkasse')
      ?{code:'OK',eventId:saved.id,replayed:true}:{code:'CONFLICT'};
  }

  await tx.execute(sql`SELECT private.lock_shipping_customer_v1(${auth.tenantId},${customerId})`);
  const orders=await tx.execute<{version:number}>(sql`
    SELECT version FROM public.orders WHERE tenant_id=${auth.tenantId} AND id=${orderId} AND customer_id=${customerId} FOR UPDATE`);
  if(orders.length!==1||orders[0].version!==expectedVersion)return {code:'CONFLICT'};
  const pending=await pruefeHerausgabe(tx,auth,{customerId,orderId},true);
  if(!pending.frei&&pending.grund==='unbekannt')return {code:'UNAVAILABLE'};
  if(pending.frei||pending.grund!=='liefersperre'&&pending.grund!=='vorkasse'||!pending.ausnahme)return {code:'CONFLICT'};
  const payload={customerId,grund:pending.grund};
  const persisted=await tx.execute<{id:string}>(sql`
    INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,notes,payload,status,
      client_event_id,correlation_id,event_schema_version,aggregate_version)
    VALUES(gen_random_uuid()::text,${auth.tenantId},${orderId},${promiseExceptionType},${MAIL_PROMISE_COPY.override},
      ${auth.userId}::uuid,${reason},${JSON.stringify(payload)}::jsonb,'success',${clientEventId}::uuid,${clientEventId}::uuid,1,${expectedVersion})
    RETURNING id`);
  if(persisted.length!==1||!persisted[0]?.id)throw Error('MAIL_PROMISE_EXCEPTION_NOT_SAVED');
  return {code:'OK',eventId:persisted[0].id,replayed:false};
}
