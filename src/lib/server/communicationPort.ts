import {MAIL_RESEND_COPY} from '@/ui/situationCatalog';
import "server-only";

import { randomUUID,createHash } from "node:crypto";
import {InvoiceMailListChanged,InvoiceAlreadySent,appendCommunicationDocument,communicationDocumentBody,communicationDocumentIntent,type CommunicationDocument} from './communicationDocumentPort';
import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import {hasAuthorizationArea} from '@/lib/server/authorization';
import {INVOICE_DELIVERY_COPY,MAIL_REQUEST_CONFLICT_COPY,COLLECTION_REMINDER_COPY} from '@/ui/situationCatalog';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {prepareCollectionReminder,appendCollectionReminderSent,type CollectionReminderMeta} from './collectionReminderPort';
import {
  listMicrosoftGraphInbox,
  readMicrosoftGraphConfigurationStatus,
  sendMicrosoftGraphMail,
  readMicrosoftGraphSentMailByRequest,
  type GraphInboxMessage,
  type GraphMailAttachment,
} from "@/lib/server/microsoftGraph";

type TargetType = "CUSTOMER" | "ORDER";
export async function readComplaintGoodsReminderContext(auth:AuthorizationSnapshot,orderId:string) {
  if(!hasAuthorizationArea(auth,'kunden'))return null;
  const rows=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{complaintId:string;version:number;orderId:string;number:string;customerName:string;complaintNumber:string}>(sql`SELECT complaint_id AS "complaintId",version,nacharbeit_auftrag_id AS "orderId",rework_order_number AS number,source_customer_name AS "customerName",nummer AS "complaintNumber" FROM public.v_complaint_rework_context_v1 WHERE tenant_id=${auth.tenantId} AND nacharbeit_auftrag_id=${orderId} AND stand='massnahme_nacharbeit' AND rework_ware='erwartet'`));
  return rows.length===1?rows[0]:null;
}
export async function readComplaintGoodsReminderDates(tx:import('./privilegedDb').PrivilegedTenantTransaction,auth:AuthorizationSnapshot,ids:readonly string[]) {
  if(!ids.length||!hasAuthorizationArea(auth,'kunden'))return [];
  return tx.execute<{complaintId:string;sentAt:string}>(sql`SELECT complaint.complaint_id AS "complaintId",max(thread.updated_at)::text AS "sentAt"
    FROM public.v_complaint_rework_context_v1 complaint JOIN public.communication_threads thread ON thread.tenant_id=complaint.tenant_id AND thread.order_id=complaint.nacharbeit_auftrag_id AND thread.customer_id=complaint.customer_id
    JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id AND message.direction='outgoing' AND message.channel='email' AND message.summary='Reklamation '||complaint.complaint_id||' · Begleitschein'
    WHERE complaint.tenant_id=${auth.tenantId} AND complaint.complaint_id=ANY(ARRAY[${sql.join(ids.map(id=>sql`${id}`),sql`, `)}]::text[]) AND thread.status='sent' AND thread.updated_at>=complaint.rework_ware_since GROUP BY complaint.complaint_id`);
}
type Result<T> = { code: "OK"; data: T } | { code: "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT" | "IN_KLAERUNG" | "UNAVAILABLE"; message: string;resend?:{requestId:string;label:string} };
type Target = { customerId: string; orderId: string | null; email: string; label: string };
type ThreadRow = { id: string; customer_id: string | null; order_id: string | null; status: string | null; created_at: Date | string | null;created_by?:string };
type LinkedMessageRow = {
  thread_id: string;
  source: string;
  subject: string | null;
  body: string | null;
  summary: string | null;
  received_at: Date | string | null;
};

function logCommunicationFailure(code: string, error: unknown) {
  console.error(`[${code}]`, error instanceof Error ? error.message : "UNKNOWN_ERROR");
}

export type CommunicationReceipt = { threadId: string; messageId: string | null; customerId: string; orderId: string | null; recordedAt: string; replayed: boolean; attachmentsImported?: number; attachmentsSkipped?: number; attachmentWarning?: string };
function canRead(auth: AuthorizationSnapshot) {
  return auth.areas?.includes("mails") === true;
}

function canWrite(auth: AuthorizationSnapshot) {
  return auth.areas?.includes("mails") === true;
}

function validTarget(type: unknown, id: unknown): type is TargetType {
  return (type === "CUSTOMER" || type === "ORDER") && typeof id === "string" && id.trim() === id && id.length >= 1 && id.length <= 128;
}

function iso(value: Date | string | null) {
  const date = value instanceof Date ? value : new Date(value ?? "");
  if (!Number.isFinite(date.getTime())) throw new Error("COMMUNICATION_TIME_INVALID");
  return date.toISOString();
}

async function resolveTarget(auth:AuthorizationSnapshot,type:TargetType,id:string):Promise<Target|null>{return withPrivilegedTenantTransaction(auth,tx=>readCommunicationTargetInTransaction(tx,auth,type,id));}
export async function readCommunicationTargetInTransaction(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,type:TargetType,id:string):Promise<Target|null>{
 if(!validTarget(type,id))return null;
  const rows = type === "CUSTOMER"
      ? await tx.execute<{ customer_id: string; order_id: null; email: string | null; label: string }>(sql`
          SELECT id AS customer_id, NULL::text AS order_id, email, name AS label
          FROM public.customers WHERE tenant_id=${auth.tenantId} AND id=${id} LIMIT 2
        `)
      : await tx.execute<{ customer_id: string; order_id: string; email: string | null; label: string }>(sql`
          SELECT customer.id AS customer_id, orders.id AS order_id, customer.email,
                 concat(orders.order_number, ' · ', customer.name) AS label
          FROM public.orders orders
          JOIN public.customers customer ON customer.id=orders.customer_id AND customer.tenant_id=orders.tenant_id
          WHERE orders.tenant_id=${auth.tenantId} AND orders.id=${id} LIMIT 2
        `);
    if (rows.length !== 1 || !rows[0]) return null;
    const email = rows[0].email?.trim().toLowerCase() ?? "";
    return { customerId: rows[0].customer_id, orderId: rows[0].order_id, email, label: rows[0].label };
}
/** Historical correspondence is projected into the intake once, without changing its target. */
export async function readCommunicationImportContext(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,graphId:string){
 const rows=await tx.execute<{customerId:string|null;orderId:string|null}>(sql`SELECT thread.customer_id AS "customerId",thread.order_id AS "orderId" FROM public.communication_threads thread WHERE thread.tenant_id=${auth.tenantId} AND thread.source=${'MS_GRAPH_IN:'+graphId}`);
 if(rows.length>1)throw Error('COMMUNICATION_SOURCE_AMBIGUOUS');
 const previous=rows[0];if(!previous||!previous.customerId&&!previous.orderId)return null;
 const target=await readCommunicationTargetInTransaction(tx,auth,previous.orderId?'ORDER':'CUSTOMER',previous.orderId??previous.customerId!);
 if(!target||previous.customerId&&previous.customerId!==target.customerId)throw Error('COMMUNICATION_LEGACY_TARGET_INVALID');
 return {customerId:target.customerId,orderId:target.orderId};
}

export async function readCommunicationInbox(auth: AuthorizationSnapshot): Promise<Result<GraphInboxMessage[]>> {
  if (!canRead(auth)) return { code: "FORBIDDEN", message: "Der Outlook-Eingang ist für diese Rolle nicht freigegeben." };
  return listMicrosoftGraphInbox();
}

export async function readLinkedCommunicationMessages(
  auth: AuthorizationSnapshot,
  input: { targetType: TargetType; targetId: string },
): Promise<Result<GraphInboxMessage[]>> {
  if (!validTarget(input?.targetType, input?.targetId)) {
    return { code: "VALIDATION_ERROR", message: "Mail-Zuordnung ist ungültig." };
  }
  if (!canRead(auth)) {
    return { code: "FORBIDDEN", message: "Der Outlook-Eingang ist für diese Rolle nicht freigegeben." };
  }
  const target = await resolveTarget(auth, input.targetType, input.targetId).catch((error) => {
    logCommunicationFailure("COMMUNICATION_LINKED_TARGET_READ_FAILED", error);
    return null;
  });
  if (!target) return { code: "NOT_FOUND", message: "Kunde oder Auftrag ist nicht verfügbar." };
  try {
    const rows = await withPrivilegedTenantTransaction(auth, (tx) => tx.execute<LinkedMessageRow>(sql`
      SELECT thread.id::text AS thread_id, thread.source, thread.subject,
        message.body, message.summary, message.created_at AS received_at
      FROM public.communication_threads thread
      JOIN LATERAL (
        SELECT stored.body, stored.summary, stored.created_at
        FROM public.communication_messages stored
        WHERE stored.tenant_id = thread.tenant_id
          AND stored.thread_id = thread.id
          AND stored.direction = 'incoming'
          AND stored.channel = 'email'
        ORDER BY stored.created_at DESC, stored.id DESC
        LIMIT 1
      ) message ON true
      WHERE thread.tenant_id = ${auth.tenantId}
        AND thread.source LIKE 'MS_GRAPH_IN:%'
        AND NOT EXISTS(SELECT 1 FROM public.intake_item canonical WHERE canonical.tenant_id=thread.tenant_id AND canonical.graph_message_id=substring(thread.source FROM 13) AND canonical.kunde_id IS NOT NULL)
        AND ((${input.targetType} = 'ORDER' AND thread.order_id = ${target.orderId})
          OR (${input.targetType} = 'CUSTOMER' AND thread.customer_id = ${target.customerId}))
      ORDER BY message.created_at DESC, thread.id DESC
      LIMIT 25
    `));
    const data = rows.map((row) => {
      const graphMessageId = row.source.slice("MS_GRAPH_IN:".length);
      if (!/^[0-9a-f-]{36}$/i.test(row.thread_id) || !graphMessageId || graphMessageId.length > 1024) {
        throw new Error("COMMUNICATION_LINKED_ROW_INVALID");
      }
      const sender = /^(.+?)\s+<([^<>\s]+)>$/.exec(row.summary?.trim() ?? "");
      const body = row.body?.trim() || "fehlt";
      return {
        id: graphMessageId,
        internetMessageId: null,
        subject: row.subject?.trim() || "fehlt",
        body,
        preview: body,
        senderName: sender?.[1]?.trim() || "fehlt",
        senderAddress: sender?.[2]?.trim() || "fehlt",
        receivedAt: iso(row.received_at),
        hasAttachments: null,
      };
    });
    return { code: "OK", data };
  } catch (error) {
    logCommunicationFailure("COMMUNICATION_LINKED_READ_FAILED", error);
    return { code: "UNAVAILABLE", message: "Zugeordnete Mails konnten nicht sicher geladen werden." };
  }
}

export async function attachInboxMessage(
  auth: AuthorizationSnapshot,
  input: { targetType: TargetType; targetId: string; graphMessageId: string },
  persistedMessage:GraphInboxMessage,
): Promise<Result<CommunicationReceipt>> {
  if (!validTarget(input?.targetType, input?.targetId) || typeof input.graphMessageId !== "string" || input.graphMessageId.length < 1 || input.graphMessageId.length > 1024) {
    return { code: "VALIDATION_ERROR", message: "Mail oder Zuordnung ist ungültig." };
  }
  if (!canWrite(auth)) return { code: "FORBIDDEN", message: "Mails dürfen für diese Rolle nicht zugeordnet werden." };
  const target = await resolveTarget(auth, input.targetType, input.targetId).catch((error) => {
    logCommunicationFailure("COMMUNICATION_TARGET_READ_FAILED", error);
    return null;
  });
  if (!target) return { code: "NOT_FOUND", message: "Kunde oder Auftrag ist nicht verfügbar." };
  const graph = {code:'OK' as const,data:persistedMessage};
  const source = `MS_GRAPH_IN:${graph.data.id}`;
  try {
    const stored = await withPrivilegedTenantTransaction(auth, async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${auth.tenantId}:${source}`}, 0))`);
      const existing = await tx.execute<ThreadRow>(sql`
        SELECT id, customer_id, order_id, status, created_at FROM public.communication_threads
        WHERE tenant_id=${auth.tenantId} AND source=${source} LIMIT 2 FOR UPDATE
      `);
      if (existing.length > 1) throw new Error("COMMUNICATION_SOURCE_AMBIGUOUS");
      if (existing[0]) {
        if (existing[0].customer_id !== target.customerId || existing[0].order_id !== target.orderId) {
          // The app action has already authorized and committed the canonical intake binding.
          // This historical correspondence row is only its projection, never another decision.
          await tx.execute(sql`UPDATE public.communication_threads SET customer_id=${target.customerId},order_id=${target.orderId},updated_at=statement_timestamp() WHERE tenant_id=${auth.tenantId} AND id=${existing[0].id}`);
        }
        return { code: "OK" as const, data: { threadId: existing[0].id, messageId: null, customerId: target.customerId, orderId: target.orderId, recordedAt: iso(existing[0].created_at), replayed: true } };
      }
      const threadId = randomUUID();
      const messageId = randomUUID();
      const threads = await tx.execute<ThreadRow>(sql`
        INSERT INTO public.communication_threads (id, tenant_id, customer_id, order_id, source, subject, status, priority, category, created_by)
        VALUES (${threadId}, ${auth.tenantId}, ${target.customerId}, ${target.orderId}, ${source}, ${graph.data.subject}, 'received', 'normal', 'email', ${auth.userId})
        RETURNING id, customer_id, order_id, status, created_at
      `);
      if (threads.length !== 1 || !threads[0]) throw new Error("COMMUNICATION_THREAD_INSERT_FAILED");
      const messages = await tx.execute<{ id: string }>(sql`
        INSERT INTO public.communication_messages (id, tenant_id, thread_id, direction, channel, body, summary, created_by)
        VALUES (${messageId}, ${auth.tenantId}, ${threadId}, 'incoming', 'email', ${graph.data.body || graph.data.preview}, ${`${graph.data.senderName} <${graph.data.senderAddress}>`}, ${auth.userId})
        RETURNING id
      `);
      if (messages.length !== 1 || messages[0]?.id !== messageId) throw new Error("COMMUNICATION_MESSAGE_INSERT_FAILED");
      return { code: "OK" as const, data: { threadId, messageId, customerId: target.customerId, orderId: target.orderId, recordedAt: iso(threads[0].created_at), replayed: false } };
    });
    if (stored.code !== "OK") return stored;
    return stored;
  } catch (error) {
    logCommunicationFailure("COMMUNICATION_ATTACH_FAILED", error);
    return { code: "UNAVAILABLE", message: "Die Mail konnte nicht sicher am Vorgang abgelegt werden." };
  }
}

export async function sendCommunicationMail(
  auth: AuthorizationSnapshot,
  input: { targetType: TargetType; targetId: string; clientRequestId: string; subject: string; body: string; confirmedResend?:true; attachment?: GraphMailAttachment; additionalAttachments?:GraphMailAttachment[]; document?:CommunicationDocument; collectionReminder?:CollectionReminderMeta; beforePrepare?:(tx:PrivilegedTenantTransaction,recipient:string)=>Promise<boolean>; complaintResult?:{complaintId:string;version:number;kind?:'reminder'} },
): Promise<Result<CommunicationReceipt>> {
  if (input?.confirmedResend!==undefined&&input.confirmedResend!==true || !validTarget(input?.targetType, input?.targetId) || typeof input.clientRequestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.clientRequestId) || typeof input.subject !== 'string' || typeof input.body !== 'string' || input.subject.trim().length < 1 || input.subject.length > 500 || input.body.trim().length < 1 || input.body.length > 20_000) {
    return { code: "VALIDATION_ERROR", message: "Empfänger, Betreff oder Nachricht ist ungültig." };
  }
  // The bound 4.8 result mail requires Kunden. It grants no inbox or arbitrary
  // mail access: target, state and version are read from the complaint itself.
  const reminder=input.complaintResult?.kind==='reminder';
  const complaintSummary=input.complaintResult?'Reklamation '+input.complaintResult.complaintId+(reminder?' · Begleitschein':' · Ergebnis'):null;
  if(input.document&&(!input.attachment||!['QUOTE','INVOICE'].includes(input.document.kind)||!Number.isSafeInteger(input.document.version)||input.document.version<1||input.document.kind==='QUOTE'&&(!Number.isSafeInteger(input.document.edition)||input.document.edition<1)||input.document.sha256!==createHash('sha256').update(input.attachment.bytes).digest('hex')))return {code:'VALIDATION_ERROR',message:'Belegfassung oder PDF-Nachweis ist ungültig.'};
  const bundle=input.document?.kind==='INVOICE'?input.document.bundle??[]:[];
  if(bundle.length!==(input.additionalAttachments?.length??0)||bundle.some((doc,index)=>doc.sha256!==createHash('sha256').update(input.additionalAttachments![index].bytes).digest('hex')))return {code:'VALIDATION_ERROR',message:'Sammel-Belege passen nicht zu den Original-PDFs.'};
  if(input.document)input={...input,body:communicationDocumentBody(input.body,input.document)};
  if(input.complaintResult){
    if(!hasAuthorizationArea(auth,'kunden')||input.targetType!=='ORDER')return {code:'FORBIDDEN',message:'Kunde informieren erfordert Kunden.'};
    const context=await withPrivilegedTenantTransaction(auth,tx=>tx.execute(sql`SELECT complaint_id FROM public.v_complaint_rework_context_v1 complaint WHERE tenant_id=${auth.tenantId} AND complaint_id=${input.complaintResult!.complaintId} AND ${reminder?sql`nacharbeit_auftrag_id=${input.targetId}`:sql`source_order_id=${input.targetId}`} AND (
      version=${input.complaintResult!.version} AND ${reminder?sql`stand='massnahme_nacharbeit' AND rework_ware='erwartet'`:sql`stand='kunde_informieren'`} OR EXISTS(
        SELECT 1 FROM public.communication_threads thread JOIN public.communication_messages message ON message.tenant_id=thread.tenant_id AND message.thread_id=thread.id
        WHERE thread.tenant_id=${auth.tenantId} AND thread.source='MS_GRAPH_OUT:'||${input.clientRequestId} AND thread.status='sent' AND thread.order_id=${input.targetId} AND thread.customer_id=complaint.customer_id
        AND message.direction='outgoing' AND message.channel='email' AND message.summary=${complaintSummary}))`)).catch(error=>{logCommunicationFailure('COMPLAINT_MAIL_CONTEXT_FAILED',error);return null;});
    if(!context)return {code:'UNAVAILABLE',message:'Reklamationsstand konnte nicht geprüft werden.'};
    if(context.length!==1)return {code:'CONFLICT',message:'Die Reklamation wurde inzwischen geändert.'};
  } else if (!canWrite(auth)) return { code: "FORBIDDEN", message: "E-Mails dürfen für diese Rolle nicht versendet werden." };
  if(!input.complaintResult&&readMicrosoftGraphConfigurationStatus().code!=='READY')return {code:'IN_KLAERUNG',message:'Microsoft 365 ist noch nicht für die Preview verbunden.'};
  const target = await resolveTarget(auth, input.targetType, input.targetId).catch((error) => {
    logCommunicationFailure("COMMUNICATION_TARGET_READ_FAILED", error);
    return null;
  });
  if (!target) return { code: "NOT_FOUND", message: "Kunde oder Auftrag ist nicht verfügbar." };
  if (!/^\S+@\S+\.\S+$/.test(target.email)) return { code: "VALIDATION_ERROR", message: "Beim Kunden ist keine gültige E-Mail-Adresse hinterlegt." };
  // PL23:01: reserve the external intent independently of a composer UUID.
  // The body remains outside the business log; its hash binds a same-key retry.
  const originals=input.document?[{id:input.document.id,sha256:input.document.sha256},...bundle.map(document=>({id:document.id,sha256:document.sha256}))]:[input.attachment,...input.additionalAttachments??[]].filter((attachment):attachment is GraphMailAttachment=>!!attachment).map(attachment=>({id:null,sha256:createHash('sha256').update(attachment.bytes).digest('hex')}));
  originals.sort((a,b)=>String(a.id??a.sha256).localeCompare(String(b.id??b.sha256)));
  const intentHash=createHash('sha256').update(JSON.stringify([target.email.trim().toLowerCase(),input.subject.trim(),input.targetType,input.targetId,target.customerId,target.orderId,originals])).digest('hex');
  const contentSha256=createHash('sha256').update(JSON.stringify([input.subject.trim(),input.body.trim()])).digest('hex');
  const source = `MS_GRAPH_OUT:${input.clientRequestId}`;
  let pending: { threadId: string; recordedAt: string; replay?: CommunicationReceipt; recovery?:true };
  try {
    pending = await withPrivilegedTenantTransaction(auth, async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${auth.tenantId}:mail-intent:${intentHash}`},0))`);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${auth.tenantId}:${source}`}, 0))`);
      const existing = await tx.execute<ThreadRow>(sql`
        SELECT id, customer_id, order_id, status, created_at,created_by::text FROM public.communication_threads
        WHERE tenant_id=${auth.tenantId} AND source=${source} LIMIT 2 FOR UPDATE
      `);
      if (existing.length > 1) throw new Error("COMMUNICATION_SOURCE_AMBIGUOUS");
      if (existing[0]) {
        if (existing[0].customer_id !== target.customerId || existing[0].order_id !== target.orderId) throw new Error("COMMUNICATION_TARGET_MISMATCH");
        if(existing[0].created_by!==auth.userId)throw Error('COMMUNICATION_REPLAY_INTENT_MISMATCH');
        const prepared=await tx.execute<{user_id:string;intent:string;content:string}>(sql`SELECT user_id::text,payload->>'intentHash' AS intent,payload->>'contentSha256' AS content FROM public.events
          WHERE tenant_id=${auth.tenantId} AND event_type='COMMUNICATION_MAIL_PREPARED_V1' AND payload->>'threadId'=${existing[0].id} AND correlation_id=${input.clientRequestId}::uuid`);
        if(prepared.length>1||prepared.length===1&&(prepared[0].user_id!==auth.userId||prepared[0].intent!==intentHash||prepared[0].content!==contentSha256))throw Error('COMMUNICATION_REPLAY_INTENT_MISMATCH');
        if (existing[0].status !== "sent") {
          if(prepared.length!==1||input.document||input.collectionReminder||input.complaintResult)throw new Error("COMMUNICATION_OUTCOME_UNCLEAR");
          return {threadId:existing[0].id,recordedAt:iso(existing[0].created_at),recovery:true as const};
        }
        if(input.collectionReminder){
         if(existing[0].created_by!==auth.userId)throw Error('COMMUNICATION_REPLAY_INTENT_MISMATCH');
         const proof=await tx.execute(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='ORDER_COLLECTION_REMINDER_SENT_V1' AND user_id=${auth.userId}::uuid AND payload->>'threadId'=${existing[0].id} AND payload->>'intent'=${input.collectionReminder.intent}`);
         if(proof.length!==1)throw Error('COMMUNICATION_REPLAY_INTENT_MISMATCH');
        }
        if(input.document){const proof=await tx.execute(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND payload->>'threadId'=${existing[0].id} AND payload->>'intent'=${communicationDocumentIntent(input,input.document)}`);if(proof.length!==1)throw Error('COMMUNICATION_DOCUMENT_REPLAY_INTENT_MISMATCH');}
        {
          const confirmed=await tx.execute<{id:string}>(sql`SELECT message.id FROM public.communication_messages message JOIN public.communication_threads thread ON thread.tenant_id=message.tenant_id AND thread.id=message.thread_id
            WHERE message.tenant_id=${auth.tenantId} AND message.thread_id=${existing[0].id} AND message.direction='outgoing' AND message.channel='email'
            AND (${complaintSummary===null} OR message.summary=${complaintSummary}) AND message.body=${input.body.trim()} AND thread.subject=${input.subject.trim()}`);
          if(confirmed.length!==1)throw Error('COMMUNICATION_REPLAY_INTENT_MISMATCH');
          return { threadId: existing[0].id, recordedAt: iso(existing[0].created_at), replay: { threadId: existing[0].id, messageId: confirmed[0].id, customerId: target.customerId, orderId: target.orderId, recordedAt: iso(existing[0].created_at), replayed: true } };
        }
      }
      const unresolved=await tx.execute<{id:string;actor:string;request_id:string;content:string;thread_id:string;created_at:Date}>(sql`SELECT prepared.id,prepared.user_id::text AS actor,prepared.correlation_id::text AS request_id,prepared.payload->>'contentSha256' AS content,thread.id::text AS thread_id,thread.created_at FROM public.events prepared
        LEFT JOIN public.communication_threads thread ON thread.tenant_id=prepared.tenant_id AND thread.id::text=prepared.payload->>'threadId'
        WHERE prepared.tenant_id=${auth.tenantId} AND prepared.event_type='COMMUNICATION_MAIL_PREPARED_V1' AND prepared.payload->>'intentHash'=${intentHash}
          AND (thread.status IS DISTINCT FROM 'sent' OR NOT EXISTS(SELECT 1 FROM public.events sent
            WHERE sent.tenant_id=prepared.tenant_id AND sent.event_type IN('COMMUNICATION_MAIL_SENT_V1','COMMUNICATION_DOCUMENT_SENT_V1')
              AND sent.user_id=prepared.user_id AND sent.payload->>'threadId'=prepared.payload->>'threadId')) LIMIT 2`);
      if(unresolved.length){
        const prior=unresolved[0];
        if(unresolved.length!==1||prior.actor!==auth.userId||prior.content!==contentSha256||!prior.thread_id||input.document||input.collectionReminder||input.complaintResult)throw Error('COMMUNICATION_OUTCOME_UNCLEAR');
        if(input.confirmedResend&&input.clientRequestId!==prior.request_id)throw Error('COMMUNICATION_REPLAY_INTENT_MISMATCH');
        input={...input,clientRequestId:prior.request_id};
        return {threadId:prior.thread_id,recordedAt:iso(prior.created_at),recovery:true as const};
      }
      if(input.confirmedResend)throw Error('COMMUNICATION_REPLAY_INTENT_MISMATCH');
      if(readMicrosoftGraphConfigurationStatus().code!=='READY')throw Error('COMMUNICATION_NOT_CONFIGURED');
      if((input.document&&!input.beforePrepare)||(input.beforePrepare&&!await input.beforePrepare(tx,target.email)))throw Error('COMMUNICATION_DOCUMENT_SNAPSHOT_CHANGED');
      const threadId = randomUUID();
      const rows = await tx.execute<ThreadRow>(sql`
        INSERT INTO public.communication_threads (id, tenant_id, customer_id, order_id, source, subject, status, priority, category, created_by)
        VALUES (${threadId}, ${auth.tenantId}, ${target.customerId}, ${target.orderId}, ${source}, ${input.subject.trim()}, 'pending', 'normal', 'email', ${auth.userId})
        RETURNING id, customer_id, order_id, status, created_at
      `);
      if (rows.length !== 1 || !rows[0]) throw new Error("COMMUNICATION_THREAD_INSERT_FAILED");
      const prepBytes=createHash('sha256').update('communication-mail-prepared:'+auth.tenantId+':'+input.clientRequestId).digest();prepBytes[6]=(prepBytes[6]&15)|80;prepBytes[8]=(prepBytes[8]&63)|128;
      const hex=prepBytes.subarray(0,16).toString('hex'),prepareKey=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
      const proof=await tx.execute(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,correlation_id,event_schema_version,created_at)
        VALUES(${randomUUID()},${auth.tenantId},${target.orderId},'COMMUNICATION_MAIL_PREPARED_V1','COMMUNICATION_MAIL_PREPARED_V1',${JSON.stringify({threadId,clientRequestId:input.clientRequestId.toLowerCase(),targetType:input.targetType,targetId:input.targetId,customerId:target.customerId,orderId:target.orderId,recipient:target.email,intentHash,contentSha256,documents:originals})}::jsonb,'success',${auth.userId}::uuid,${prepareKey}::uuid,${input.clientRequestId}::uuid,1,statement_timestamp()) RETURNING id`);
      if(proof.length!==1)throw Error('COMMUNICATION_MAIL_PREPARE_PROOF_MISSING');
      if(input.document)await appendCommunicationDocument(tx,auth,input,input.document,threadId,'prepared');
      if(input.collectionReminder)await prepareCollectionReminder(tx,auth,input.collectionReminder,{threadId,clientRequestId:input.clientRequestId,body:input.body});
      return { threadId, recordedAt: iso(rows[0].created_at) };
    });
  } catch (error) {
    logCommunicationFailure("COMMUNICATION_SEND_PREPARE_FAILED", error);
    if(error instanceof Error&&error.message==='INVOICE_EXPECTED_LIST_INVALID'&&input.document?.kind==='INVOICE')return {code:'VALIDATION_ERROR',message:INVOICE_DELIVERY_COPY.expectedListMissing(input.document.number)};
    if(error instanceof InvoiceMailListChanged)return {code:'VALIDATION_ERROR',message:INVOICE_DELIVERY_COPY.listChanged(error.number,error.added)};
    if(error instanceof InvoiceAlreadySent)return {code:'CONFLICT',message:INVOICE_DELIVERY_COPY.alreadySent(error.number,error.sentOn)};
    if(error instanceof Error&&error.message==='COMMUNICATION_DOCUMENT_SNAPSHOT_CHANGED')return {code:'VALIDATION_ERROR',message:'Beleg oder Auftragsstand wurde seit der PDF-Erstellung geändert. Es wurde nichts gesendet. Aktuellen Beleg erneut wählen.'};
    if(error instanceof Error&&error.message==='COMMUNICATION_NOT_CONFIGURED')return {code:'IN_KLAERUNG',message:'Microsoft 365 ist noch nicht für die Preview verbunden.'};
    if(error instanceof Error&&error.message==='COMMUNICATION_REPLAY_INTENT_MISMATCH')return {code:'CONFLICT',message:MAIL_REQUEST_CONFLICT_COPY};
    if(error instanceof Error&&error.message.startsWith('COLLECTION_REMINDER_'))return {code:'CONFLICT',message:COLLECTION_REMINDER_COPY.preparedConflict};
    return { code: error instanceof Error && error.message === "COMMUNICATION_OUTCOME_UNCLEAR" ? "CONFLICT" : "UNAVAILABLE", message: error instanceof Error && error.message === "COMMUNICATION_OUTCOME_UNCLEAR" ? "Der Ausgang dieses Versands ist ungeklärt. Nicht erneut senden; zuerst im Outlook-Ausgang prüfen." : "Der Mailversand konnte nicht sicher vorbereitet werden." };
  }
  if (pending.replay) return { code: "OK", data: pending.replay };
  let sentItemsEvidence:{graphMessageId:string;internetMessageId:string;clientRequestId:string|null}|undefined;
  let resendConfirmationId:string|undefined;
  if(pending.recovery){
    const proof=await readMicrosoftGraphSentMailByRequest({clientRequestId:input.clientRequestId,recipient:target.email,preparedAt:pending.recordedAt});
    if(proof.code!=='OK')return {code:'CONFLICT',message:COLLECTION_REMINDER_COPY.unclear};
    if('notFound'in proof.data){
      const confirmation=await withPrivilegedTenantTransaction(auth,async tx=>{
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${auth.tenantId}:mail-intent:${intentHash}`},0))`);
        const state=await tx.execute<{eligible:boolean;used:boolean}>(sql`SELECT statement_timestamp()>=(prepared.created_at AT TIME ZONE 'UTC')+interval '10 minutes' AS eligible,
         EXISTS(SELECT 1 FROM public.events confirmed WHERE confirmed.tenant_id=prepared.tenant_id AND confirmed.event_type='COMMUNICATION_MAIL_RESEND_CONFIRMED_V1' AND confirmed.correlation_id=prepared.correlation_id) AS used
         FROM public.events prepared JOIN public.communication_threads thread ON thread.tenant_id=prepared.tenant_id AND thread.id::text=prepared.payload->>'threadId'
         WHERE prepared.tenant_id=${auth.tenantId} AND prepared.event_type='COMMUNICATION_MAIL_PREPARED_V1' AND prepared.correlation_id=${input.clientRequestId}::uuid
          AND prepared.user_id=${auth.userId}::uuid AND prepared.payload->>'intentHash'=${intentHash} AND prepared.payload->>'contentSha256'=${contentSha256}
          AND thread.status IN('pending','failed') AND thread.id=${pending.threadId} FOR UPDATE OF thread`);
        if(state.length!==1||!state[0].eligible||state[0].used)return {available:false};
        if(!input.confirmedResend)return {available:true};
        const rows=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,correlation_id,event_schema_version,created_at)
          VALUES(${randomUUID()},${auth.tenantId},${target.orderId},'COMMUNICATION_MAIL_RESEND_CONFIRMED_V1','Versand unklar',${JSON.stringify({threadId:pending.threadId,originalRequestId:input.clientRequestId,intentHash,reason:'nicht_im_postausgang_gefunden'})}::jsonb,'success',${auth.userId}::uuid,${randomUUID()}::uuid,${input.clientRequestId}::uuid,1,statement_timestamp()) RETURNING id`);
        if(rows.length!==1)throw Error('COMMUNICATION_RESEND_CONFIRMATION_NOT_SAVED');
        const changed=await tx.execute(sql`UPDATE public.communication_threads SET status='pending' WHERE tenant_id=${auth.tenantId} AND id=${pending.threadId} AND status IN('pending','failed') RETURNING id`);
        if(changed.length!==1)throw Error('COMMUNICATION_RESEND_STATE_CHANGED');
        return {available:true,id:rows[0].id};
      });
      if(!confirmation.id)return {code:'CONFLICT',message:COLLECTION_REMINDER_COPY.unclear,...(confirmation.available?{resend:{requestId:input.clientRequestId,label:MAIL_RESEND_COPY.confirm(target.label)}}:{})};
      resendConfirmationId=confirmation.id;
    }else sentItemsEvidence=proof.data;
  }
  if(!pending.recovery||resendConfirmationId){
  const sent = await sendMicrosoftGraphMail({ to: target.email, subject: input.subject.trim(), body: input.body.trim(), attachment: input.attachment,additionalAttachments:input.additionalAttachments, replyToMessageId: input.document?.source?.graphMessageId,clientRequestId:input.clientRequestId });
  if (sent.code !== "OK") {
    await withPrivilegedTenantTransaction(auth, (tx) => tx.execute(sql`
      UPDATE public.communication_threads SET status='failed', updated_at=statement_timestamp()
      WHERE tenant_id=${auth.tenantId} AND id=${pending.threadId} AND status='pending'
    `)).catch((error) => {
      logCommunicationFailure("COMMUNICATION_SEND_FAILURE_STATUS_WRITE_FAILED", error);
      return undefined;
    });
    return sent;
  }
  }
  try {
    const messageId = randomUUID();
    await withPrivilegedTenantTransaction(auth, async (tx) => {
      const updated = await tx.execute<{ id: string }>(sql`
        UPDATE public.communication_threads SET status='sent', updated_at=statement_timestamp()
        WHERE tenant_id=${auth.tenantId} AND id=${pending.threadId} AND (status='pending' OR ${pending.recovery===true} AND status='failed') RETURNING id
      `);
      if (updated.length !== 1) throw new Error("COMMUNICATION_THREAD_FINALIZE_FAILED");
      const messages = await tx.execute<{ id: string }>(sql`
        INSERT INTO public.communication_messages (id, tenant_id, thread_id, direction, channel, body, summary, created_by)
        VALUES (${messageId}, ${auth.tenantId}, ${pending.threadId}, 'outgoing', 'email', ${input.body.trim()}, ${complaintSummary??(input.attachment ? `Anhang: ${input.attachment.filename}` : 'Ohne Anhang')}, ${auth.userId}) RETURNING id
      `);
      if (messages.length !== 1 || messages[0]?.id !== messageId) throw new Error("COMMUNICATION_MESSAGE_INSERT_FAILED");
      if(input.document)await appendCommunicationDocument(tx,auth,input,input.document,pending.threadId,'sent');
      else{
        const bytes=createHash('sha256').update('communication-mail-sent:'+auth.tenantId+':'+input.clientRequestId).digest();
        bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
        const h=bytes.subarray(0,16).toString('hex'),key=`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
        const sentReceipt=await tx.execute<{id:string}>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,correlation_id,event_schema_version,created_at)
          VALUES(${randomUUID()},${auth.tenantId},${target.orderId},'COMMUNICATION_MAIL_SENT_V1','E-Mail versendet',${JSON.stringify({threadId:pending.threadId,messageId,customerId:target.customerId,orderId:target.orderId,...(sentItemsEvidence?{sentItemsEvidence}:{}),...(resendConfirmationId?{resendConfirmationId}:{}),contentSha256:createHash('sha256').update(JSON.stringify([input.subject.trim(),input.body.trim()])).digest('hex')})}::jsonb,'success',${auth.userId},${key}::uuid,${input.clientRequestId}::uuid,1,statement_timestamp() AT TIME ZONE 'UTC') RETURNING id`);
        if(sentReceipt.length!==1)throw Error('COMMUNICATION_SENT_RECEIPT_NOT_SAVED');
      }
      if(input.collectionReminder)await appendCollectionReminderSent(tx,auth,input.collectionReminder,pending.threadId,messageId,input.clientRequestId);
    });
    return { code: "OK", data: { threadId: pending.threadId, messageId, customerId: target.customerId, orderId: target.orderId, recordedAt: pending.recordedAt, replayed: pending.recovery===true&&!resendConfirmationId } };
  } catch (error) {
    logCommunicationFailure("COMMUNICATION_SEND_FINALIZE_FAILED", error);
    return { code: "UNAVAILABLE", message: "Microsoft 365 hat die Mail angenommen, die lokale Vorgangskopie ist aber noch nicht sicher bestätigt. Nicht erneut senden." };
  }
}
