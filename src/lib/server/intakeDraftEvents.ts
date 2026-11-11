import "server-only";
import { sql } from "drizzle-orm";
import type { PrivilegedTenantTransaction } from "./privilegedDb";
import type { AuthorizationSnapshot } from "./authorization";

type Actor = Pick<AuthorizationSnapshot,"tenantId"|"userId">;
type Kind = "INTAKE_DRAFT_SAVED_V1" | "INTAKE_DRAFT_DISCARDED_V1";

/** Transaction port to the existing append-only event store, not another draft store. */
export async function readIntakeDraftEvent(tx:PrivilegedTenantTransaction,actor:Actor,clientEventId:string,kind:Kind){
  return tx.execute<{payload:{intent?:string;draftId:string;reason?:string}}>(sql`SELECT payload FROM public.events
    WHERE tenant_id=${actor.tenantId} AND user_id=${actor.userId}::uuid AND client_event_id=${clientEventId}::uuid AND event_type=${kind}`);
}
export async function appendIntakeDraftEvent(tx:PrivilegedTenantTransaction,actor:Actor,input:{kind:Kind;clientEventId:string;draftId:string;intent?:string;reason?:string}){
  await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,correlation_id,aggregate_version)
    VALUES(gen_random_uuid()::text,${actor.tenantId},${input.kind},${input.kind==="INTAKE_DRAFT_SAVED_V1"?"Erfassung als Entwurf abgelegt":"Eigener Entwurf verworfen"},
      ${JSON.stringify({draftId:input.draftId,...(input.intent?{intent:input.intent}:{}),...(input.reason?{reason:input.reason}:{})})}::jsonb,'success',${actor.userId}::uuid,${input.clientEventId}::uuid,1,gen_random_uuid(),1)`);
}
export async function hasOwnOrderIntakeReceipt(tx:PrivilegedTenantTransaction,actor:Actor,clientEventId:string){
  const rows=await tx.execute(sql`SELECT id FROM private.order_intake_receipts
    WHERE tenant_id=${actor.tenantId} AND actor_id=${actor.userId}::uuid AND client_event_id=${clientEventId}::uuid`);
  return rows.length===1;
}

/** PL02:01: source-bound mail authority, never an added general Mails grant. */
export async function readIntakeConfirmationMailSource(tx:PrivilegedTenantTransaction,actor:Actor,input:{orderId:string;outboxId:string;sourceClientEventId:string},lock=false){
 const rows=await tx.execute<{recipient:string}>(sql`SELECT outbox.an AS recipient FROM public.outbox_mails outbox
  JOIN private.order_intake_receipts receipt ON receipt.tenant_id=outbox.tenant_id AND receipt.order_id=outbox.objekt AND receipt.actor_id=${actor.userId}::uuid AND receipt.client_event_id=${input.sourceClientEventId}::uuid
  JOIN public.events event ON event.tenant_id=receipt.tenant_id AND event.id=receipt.event_id AND event.user_id=receipt.actor_id AND event.event_type='ORDER_INTAKE_CREATED_V1' AND event.status='success'
  WHERE outbox.tenant_id=${actor.tenantId} AND outbox.id=${input.outboxId}::uuid AND outbox.objekt=${input.orderId} AND outbox.vorlage='auftragsbestaetigung'
   AND (outbox.status<>'gesendet' OR EXISTS(SELECT 1 FROM public.communication_threads thread WHERE thread.tenant_id=outbox.tenant_id AND thread.source='MS_GRAPH_OUT:'||outbox.id::text))
  ${lock?sql`FOR UPDATE OF outbox`:sql``}`);
 return rows.length===1?rows[0]:null;
}

/** Root read port for canonical customer/company fields, never a second customer store. */
export async function readIntakeConfirmationContext(tx:PrivilegedTenantTransaction,actor:Actor,customerId:string,orderId:string){
  const rows=await tx.execute<{email:string|null;auto_info:boolean;salutation:string|null;first_name:string|null;last_name:string|null;company_name:string|null;street:string|null;house_number:string|null;zip_code:string|null;city:string|null;company:string|null;phone:string|null;oeffnungszeiten:string|null;wish_date:string|null}>(sql`
    SELECT c.email,c.auto_info,c.salutation,c.first_name,c.last_name,c.company_name,c.street,c.house_number,c.zip_code,c.city,
      s.company_name AS company,s.phone,s.oeffnungszeiten,
      (SELECT o.wunschtermin::text FROM public.orders o WHERE o.tenant_id=${actor.tenantId} AND o.id=${orderId} AND o.customer_id=c.id) AS wish_date
    FROM public.customers c LEFT JOIN public.company_settings s ON s.tenant_id=c.tenant_id
    WHERE c.tenant_id=${actor.tenantId} AND c.id=${customerId} LIMIT 2`);
  if(rows.length!==1)throw Error("INTAKE_CONFIRMATION_CONTEXT_INVALID");
  return rows[0];
}
