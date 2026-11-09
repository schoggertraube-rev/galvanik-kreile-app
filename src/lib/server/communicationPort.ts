import "server-only";

import { randomUUID,createHash } from "node:crypto";
import {appendCommunicationDocument,communicationDocumentIntent,type CommunicationDocument} from './communicationDocumentPort';
import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import {hasAuthorizationArea} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {
  listMicrosoftGraphInbox,
  readMicrosoftGraphConfigurationStatus,
  sendMicrosoftGraphMail,
  readMicrosoftGraphSentMailEvidence,
  type GraphInboxMessage,
  type GraphMailAttachment,
} from "@/lib/server/microsoftGraph";

type TargetType = "CUSTOMER" | "ORDER";
export function canonicalIntent(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonicalIntent).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,entry])=>JSON.stringify(key)+':'+canonicalIntent(entry)).join(',')+'}';
 return JSON.stringify(value);
}
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
type Result<T> = { code: "OK"; data: T } | { code: "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT" | "IN_KLAERUNG" | "UNAVAILABLE"; message: string;delivery?:'checking'|'failed';retryAt?:string;deliveryCustomer?:string };
type Target = { customerId: string; orderId: string | null; email: string; label: string };
type ThreadRow = { id: string; customer_id: string | null; order_id: string | null; status: string | null; created_at: Date | string | null };
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

export type CommunicationReceipt = { threadId: string; messageId: string | null; customerId: string; orderId: string | null; recordedAt: string; replayed: boolean; sourceChanged?:boolean; deliveryCustomer?:string; attachmentsImported?: number; attachmentsSkipped?: number; attachmentWarning?: string };
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

export type IntakeComplaintReply={purpose?:'no-complaint';itemId:string;version:number;graphMessageId:string;sender:string;intent:string;snapshot?:unknown;validate:(tx:PrivilegedTenantTransaction)=>Promise<boolean>;complete:(tx:PrivilegedTenantTransaction,threadId:string)=>Promise<void>;replay:(tx:PrivilegedTenantTransaction,threadId:string)=>Promise<boolean>};
export async function sendCommunicationMail(
  auth: AuthorizationSnapshot,
  input: { targetType: TargetType; targetId: string; clientRequestId: string; subject: string; body: string; attachment?: GraphMailAttachment; document?:CommunicationDocument; reconcileOnly?:true;beforePrepare?:(tx:PrivilegedTenantTransaction)=>Promise<boolean>; complaintResult?:{complaintId:string;version:number;kind?:'reminder'};intakeReply?:IntakeComplaintReply },
): Promise<Result<CommunicationReceipt>> {
  if (!validTarget(input?.targetType, input?.targetId) || !/^[0-9a-f-]{36}$/i.test(input.clientRequestId) || input.subject.trim().length < 1 || input.subject.length > 500 || input.body.trim().length < 1 || input.body.length > 20_000) {
    return { code: "VALIDATION_ERROR", message: "Empfänger, Betreff oder Nachricht ist ungültig." };
  }
  if(input.intakeReply&&(input.document||input.complaintResult||input.targetType!=='CUSTOMER'||!hasAuthorizationArea(auth,'eingang')||!hasAuthorizationArea(auth,'kunden')))return {code:'FORBIDDEN',message:'Diese Fotoanfrage benötigt einen eindeutigen Eingang und Kunden.'};
  // The bound 4.8 result mail requires Kunden. It grants no inbox or arbitrary
  // mail access: target, state and version are read from the complaint itself.
  const reminder=input.complaintResult?.kind==='reminder';
  const complaintSummary=input.complaintResult?'Reklamation '+input.complaintResult.complaintId+(reminder?' · Begleitschein':' · Ergebnis'):null;
  if(input.document&&(!input.reconcileOnly&&!input.attachment||input.document.kind!=='QUOTE'||!Number.isSafeInteger(input.document.version)||input.document.version<1||!Number.isSafeInteger(input.document.edition)||input.document.edition<1||input.attachment&&input.document.sha256!==createHash('sha256').update(input.attachment.bytes).digest('hex')))return {code:'VALIDATION_ERROR',message:'KV-Fassung oder PDF-Nachweis ist ungültig.'};
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
  const recipient=input.intakeReply?.sender??target.email;
  if (!/^\S+@\S+\.\S+$/.test(recipient)) return { code: "VALIDATION_ERROR", message: "Beim Kunden ist keine gültige E-Mail-Adresse hinterlegt." };
  const source = `MS_GRAPH_OUT:${input.clientRequestId}`;
  const sendIntent=createHash('sha256').update(canonicalIntent({targetType:input.targetType,targetId:input.targetId,recipient,subject:input.subject.trim(),body:input.body.trim(),attachment:input.document?{filename:input.document.number+'.pdf',sha256:input.document.sha256}:input.attachment?{filename:input.attachment.filename,sha256:createHash('sha256').update(input.attachment.bytes).digest('hex')}:null,document:input.document??null,complaint:input.complaintResult??null,intake:input.intakeReply?{id:input.intakeReply.itemId,intent:input.intakeReply.intent}:null})).digest('hex');
  let pending: { threadId: string; recordedAt: string; replay?: CommunicationReceipt;check?:boolean;failed?:boolean };
  try {
    pending = await withPrivilegedTenantTransaction(auth, async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${auth.tenantId}:${source}`}, 0))`);
      const existing = await tx.execute<ThreadRow>(sql`
        SELECT id, customer_id, order_id, status, created_at FROM public.communication_threads
        WHERE tenant_id=${auth.tenantId} AND source=${source} LIMIT 2 FOR UPDATE
      `);
      if (existing.length > 1) throw new Error("COMMUNICATION_SOURCE_AMBIGUOUS");
      if (existing[0]) {
        if (existing[0].customer_id !== target.customerId || existing[0].order_id !== target.orderId) throw new Error("COMMUNICATION_TARGET_MISMATCH");
        const prepared=await tx.execute<{intent:string}>(sql`SELECT payload->>'intent' AS intent FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='COMMUNICATION_SEND_PREPARED_V1' AND payload->>'threadId'=${existing[0].id}`);
        if(prepared.length>1||prepared.length===1&&prepared[0].intent!==sendIntent)throw Error('COMMUNICATION_REPLAY_INTENT_MISMATCH');
        if (existing[0].status !== "sent"){
          if(prepared.length!==1)throw Error('COMMUNICATION_OUTCOME_UNCLEAR');
          return {threadId:existing[0].id,recordedAt:iso(existing[0].created_at),check:true,failed:existing[0].status==='failed'};
        }
        if(input.document){const proof=await tx.execute(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='COMMUNICATION_DOCUMENT_SENT_V1' AND payload->>'threadId'=${existing[0].id} AND payload->>'intent'=${communicationDocumentIntent(input,input.document)}`);if(proof.length!==1)throw Error('COMMUNICATION_DOCUMENT_REPLAY_INTENT_MISMATCH');}
        if(input.complaintResult){
          const confirmed=await tx.execute(sql`SELECT message.id FROM public.communication_messages message JOIN public.communication_threads thread ON thread.tenant_id=message.tenant_id AND thread.id=message.thread_id
            WHERE message.tenant_id=${auth.tenantId} AND message.thread_id=${existing[0].id} AND message.direction='outgoing' AND message.channel='email'
            AND message.summary=${complaintSummary} AND message.body=${input.body.trim()} AND thread.subject=${input.subject.trim()}`);
          if(confirmed.length!==1)throw Error('COMMUNICATION_REPLAY_INTENT_MISMATCH');
        }
        const sourceChanged=(await tx.execute(sql`SELECT id FROM public.events WHERE tenant_id=${auth.tenantId} AND event_type='COMMUNICATION_SOURCE_CHANGED_V1' AND payload->>'threadId'=${existing[0].id}`)).length===1;
        if(input.intakeReply&&!sourceChanged&&!await input.intakeReply.replay(tx,existing[0].id))throw Error('COMMUNICATION_REPLAY_INTENT_MISMATCH');
        return { threadId: existing[0].id, recordedAt: iso(existing[0].created_at), replay: { threadId: existing[0].id, messageId: null, customerId: target.customerId, orderId: target.orderId, recordedAt: iso(existing[0].created_at), replayed: true,...(sourceChanged?{sourceChanged:true,deliveryCustomer:target.label}:{}) } };
      }
      if(input.reconcileOnly)throw Error('COMMUNICATION_PREPARED_RECEIPT_MISSING');
      if(readMicrosoftGraphConfigurationStatus().code!=='READY')throw Error('COMMUNICATION_NOT_CONFIGURED');
      if(input.intakeReply&&!await input.intakeReply.validate(tx))throw Error('COMMUNICATION_INTAKE_SNAPSHOT_CHANGED');
      if(input.document&&(!input.beforePrepare||!await input.beforePrepare(tx)))throw Error('COMMUNICATION_DOCUMENT_SNAPSHOT_CHANGED');
      const threadId = randomUUID();
      const rows = await tx.execute<ThreadRow>(sql`
        INSERT INTO public.communication_threads (id, tenant_id, customer_id, order_id, source, subject, status, priority, category, created_by)
        VALUES (${threadId}, ${auth.tenantId}, ${target.customerId}, ${target.orderId}, ${source}, ${input.subject.trim()}, 'pending', 'normal', 'email', ${auth.userId})
        RETURNING id, customer_id, order_id, status, created_at
      `);
      if (rows.length !== 1 || !rows[0]) throw new Error("COMMUNICATION_THREAD_INSERT_FAILED");
      if(input.document)await appendCommunicationDocument(tx,auth,input,input.document,threadId,'prepared');
      await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,correlation_id,created_at) VALUES(${randomUUID()}::uuid,${auth.tenantId},'COMMUNICATION_SEND_PREPARED_V1','Mailversand vorbereitet',${JSON.stringify({threadId,sendKey:input.clientRequestId,intent:sendIntent,recipient,customerName:target.label,...(input.intakeReply?{intake:{itemId:input.intakeReply.itemId,version:input.intakeReply.version,purpose:input.intakeReply.purpose??'photo-request',graphMessageId:input.intakeReply.graphMessageId,snapshot:input.intakeReply.snapshot}}:{})})}::jsonb,'success',${auth.userId}::uuid,${randomUUID()}::uuid,1,${input.clientRequestId}::uuid,statement_timestamp())`);
      return { threadId, recordedAt: iso(rows[0].created_at) };
    });
  } catch (error) {
    logCommunicationFailure("COMMUNICATION_SEND_PREPARE_FAILED", error);
    if(error instanceof Error&&error.message==='COMMUNICATION_DOCUMENT_SNAPSHOT_CHANGED')return {code:'VALIDATION_ERROR',message:'KV wurde seit der PDF-Erstellung geändert. Es wurde nichts gesendet. Aktuellen KV erneut wählen.'};
    if(error instanceof Error&&error.message==='COMMUNICATION_NOT_CONFIGURED')return {code:'IN_KLAERUNG',message:'Microsoft 365 ist noch nicht für die Preview verbunden.'};
    return { code: error instanceof Error && error.message === "COMMUNICATION_OUTCOME_UNCLEAR" ? "CONFLICT" : "UNAVAILABLE", message: error instanceof Error && error.message === "COMMUNICATION_OUTCOME_UNCLEAR" ? "Der Ausgang dieses Versands ist ungeklärt. Nicht erneut senden; zuerst im Outlook-Ausgang prüfen." : "Der Mailversand konnte nicht sicher vorbereitet werden." };
  }
  if (pending.replay) return { code: "OK", data: pending.replay };
  let reconciled:{graphMessageId:string;internetMessageId:string;sentAt:string}|null=null;
  const checking=()=>({code:'CONFLICT' as const,delivery:'checking' as const,retryAt:new Date(Date.parse(pending.recordedAt)+300000>Date.now()?Date.parse(pending.recordedAt)+300000:Date.now()+300000).toISOString(),message:'Wird gerade geprüft'});
  const notSent=()=>({code:'CONFLICT' as const,delivery:'failed' as const,deliveryCustomer:target.label,message:'Mail an '+target.label+' ist nicht rausgegangen - erneut senden'});
  if(pending.failed)return notSent();
  if(pending.check){
    if(Date.now()<Date.parse(pending.recordedAt)+300000)return checking();
    const proof=await readMicrosoftGraphSentMailEvidence({sendKey:input.clientRequestId,recipient,preparedAt:pending.recordedAt});
    if(proof.code!=='OK')return checking();
    if(proof.data.state==='not-found'){
      try{await withPrivilegedTenantTransaction(auth,async tx=>{
        const changed=await tx.execute(sql`UPDATE public.communication_threads SET status='failed',updated_at=statement_timestamp() WHERE tenant_id=${auth.tenantId} AND id=${pending.threadId} AND status='pending' RETURNING id`);
        if(changed.length!==1)throw Error('COMMUNICATION_RECONCILE_CONCURRENT_CHANGE');
        if(changed.length)await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,correlation_id,created_at) VALUES(${randomUUID()}::uuid,${auth.tenantId},'COMMUNICATION_SEND_NOT_FOUND_V1','Mailversand nicht bestätigt',${JSON.stringify({threadId:pending.threadId,sendKey:input.clientRequestId,intent:sendIntent})}::jsonb,'success',${auth.userId}::uuid,${randomUUID()}::uuid,1,${input.clientRequestId}::uuid,statement_timestamp())`);
      });}catch(error){logCommunicationFailure('COMMUNICATION_RECONCILE_FAILED',error);return checking();}
      return notSent();
    }
    reconciled=proof.data;
  }
  const sent = reconciled?{code:'OK' as const}:await sendMicrosoftGraphMail({ to: recipient, subject: input.subject.trim(), body: input.body.trim(), attachment: input.attachment, replyToMessageId: input.intakeReply?.graphMessageId??input.document?.source?.graphMessageId,sendKey:input.clientRequestId });
  if (sent.code !== "OK") {
    return {...sent,delivery:'checking',retryAt:new Date(Date.parse(pending.recordedAt)+300000).toISOString()};
  }
  try {
    const messageId = randomUUID();
    let sourceChanged=false;
    await withPrivilegedTenantTransaction(auth, async (tx) => {
      const updated = await tx.execute<{ id: string }>(sql`
        UPDATE public.communication_threads SET status='sent', updated_at=statement_timestamp()
        WHERE tenant_id=${auth.tenantId} AND id=${pending.threadId} AND status='pending' RETURNING id
      `);
      if (updated.length !== 1) throw new Error("COMMUNICATION_THREAD_FINALIZE_FAILED");
      const messages = await tx.execute<{ id: string }>(sql`
        INSERT INTO public.communication_messages (id, tenant_id, thread_id, direction, channel, body, summary, created_by)
        VALUES (${messageId}, ${auth.tenantId}, ${pending.threadId}, 'outgoing', 'email', ${input.body.trim()}, ${input.intakeReply?(input.intakeReply.purpose==='no-complaint'?'Reklamation · Antwort · Eingang ':'Reklamation · Fotos anfordern · Eingang ')+input.intakeReply.itemId:complaintSummary??(input.attachment ? `Anhang: ${input.attachment.filename}` : 'Ohne Anhang')}, ${auth.userId}) RETURNING id
      `);
      if (messages.length !== 1 || messages[0]?.id !== messageId) throw new Error("COMMUNICATION_MESSAGE_INSERT_FAILED");
      if(reconciled)await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,correlation_id,created_at) VALUES(${randomUUID()}::uuid,${auth.tenantId},'COMMUNICATION_SEND_RECONCILED_V1','Gesendete Mail abgeglichen',${JSON.stringify({threadId:pending.threadId,sendKey:input.clientRequestId,intent:sendIntent,...reconciled})}::jsonb,'success',${auth.userId}::uuid,${randomUUID()}::uuid,1,${input.clientRequestId}::uuid,statement_timestamp())`);
      if(input.document){await appendCommunicationDocument(tx,auth,input,input.document,pending.threadId,'sent');if(input.beforePrepare&&!await input.beforePrepare(tx))sourceChanged=true;}
      if(input.intakeReply){
       await tx.execute(sql`SAVEPOINT communication_domain_completion`);
       try{await input.intakeReply.complete(tx,pending.threadId);await tx.execute(sql`INSERT INTO public.events(tenant_id,id,event_type,user_id,client_event_id,event_schema_version,correlation_id,aggregate_version,status,description,payload)
       VALUES(${auth.tenantId},${randomUUID()},${input.intakeReply.purpose==='no-complaint'?'INTAKE_COMPLAINT_RESPONSE_SENT_V1':'INTAKE_COMPLAINT_PHOTO_REQUESTED_V1'},${auth.userId}::uuid,${input.clientRequestId}::uuid,1,${input.clientRequestId}::uuid,${input.intakeReply.version+1},'success',${input.intakeReply.purpose==='no-complaint'?'Keine Reklamation · Antwort gesendet':'Reklamationsfotos angefordert'},${JSON.stringify({itemId:input.intakeReply.itemId,threadId:pending.threadId,intent:input.intakeReply.intent})}::jsonb)`);
       }catch(error){
        const code=error instanceof Error?error.message:'';
        if(!['COMPLAINT_PHOTO_MAIL_VERSION_CONFLICT','COMPLAINT_PHOTO_MAIL_SOURCE_INVALID','COMPLAINT_PHOTO_MAIL_PHOTOS_ALREADY_PRESENT','COMPLAINT_RESPONSE_SOURCE_CHANGED','COMPLAINT_RESPONSE_VERSION_CONFLICT','COMPLAINT_SOURCE_CHANGED','COMPLAINT_SOURCE_TARGET_MISMATCH','COMPLAINT_RESPONSE_ROOT_COMPLETED'].includes(code))throw error;
        await tx.execute(sql`ROLLBACK TO SAVEPOINT communication_domain_completion`);sourceChanged=true;logCommunicationFailure('COMMUNICATION_SOURCE_CHANGED_AFTER_SEND',error);
       }
       await tx.execute(sql`RELEASE SAVEPOINT communication_domain_completion`);
      }
      if(sourceChanged)await tx.execute(sql`INSERT INTO public.events(id,tenant_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,correlation_id,created_at) VALUES(${randomUUID()}::uuid,${auth.tenantId},'COMMUNICATION_SOURCE_CHANGED_V1','Mail gesendet · Fachstand inzwischen geändert',${JSON.stringify({threadId:pending.threadId,sendKey:input.clientRequestId,intent:sendIntent,intake:input.intakeReply?{itemId:input.intakeReply.itemId,version:input.intakeReply.version,graphMessageId:input.intakeReply.graphMessageId,intent:input.intakeReply.intent}:null})}::jsonb,'success',${auth.userId}::uuid,${randomUUID()}::uuid,1,${input.clientRequestId}::uuid,statement_timestamp())`);

    });
    return { code: "OK", data: { threadId: pending.threadId, messageId, customerId: target.customerId, orderId: target.orderId, recordedAt: pending.recordedAt, replayed: false,...(sourceChanged?{sourceChanged:true,deliveryCustomer:target.label}:{}) } };
  } catch (error) {
    logCommunicationFailure("COMMUNICATION_SEND_FINALIZE_FAILED", error);
    return { code: "UNAVAILABLE", message: "Microsoft 365 hat die Mail angenommen, die lokale Vorgangskopie ist aber noch nicht sicher bestätigt. Nicht erneut senden." };
  }
}

/** Confirmed absent sends from the communication owner's journal, for intake retry guards. */
export async function readAbsentCommunicationSendKeys(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot):Promise<string[]>{
 if(!hasAuthorizationArea(auth,'mails'))return [];
 const rows=await tx.execute<{key:string}>(sql`SELECT DISTINCT proof.correlation_id::text AS key FROM public.communication_threads thread JOIN public.events proof ON proof.tenant_id=thread.tenant_id AND proof.event_type='COMMUNICATION_SEND_NOT_FOUND_V1' AND proof.payload->>'threadId'=thread.id::text
 WHERE thread.tenant_id=${auth.tenantId} AND thread.status='failed' AND thread.source='MS_GRAPH_OUT:'||proof.correlation_id::text`);
 return rows.map(row=>row.key);
}

/** Recover the original actor's unresolved photo send from its actual journal, including after reopening. */
export async function readComplaintPhotoDelivery(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,ids:readonly string[]){
 if(!ids.length||!hasAuthorizationArea(auth,'mails'))return new Map<string,{state:'checking'|'failed'|'source-changed';deliveryCustomer?:string;clientRequestId:string|null;version:number;retryAt:string}>();
 const rows=await tx.execute<{id:string;status:string;deliveryCustomer:string|null;clientKey:string;version:number;currentVersion:number;own:boolean;retryAt:string}>(sql`
 SELECT DISTINCT ON(source.id) source.id::text,thread.status,prepared.payload->>'customerName' AS "deliveryCustomer",prepared.payload->>'sendKey' AS "clientKey",(prepared.payload->'intake'->>'version')::integer AS version,source.version AS "currentVersion",thread.created_by=${auth.userId}::uuid AS own,(thread.created_at+interval '5 minutes')::text AS "retryAt"
 FROM public.intake_item source JOIN public.events prepared ON prepared.tenant_id=source.tenant_id AND prepared.event_type='COMMUNICATION_SEND_PREPARED_V1' AND prepared.payload->'intake'->>'itemId'=source.id::text AND prepared.payload->'intake'->>'purpose'='photo-request' AND prepared.payload->'intake'->>'graphMessageId'=source.graph_message_id
 JOIN public.communication_threads thread ON thread.tenant_id=prepared.tenant_id AND thread.id::text=prepared.payload->>'threadId' AND thread.source='MS_GRAPH_OUT:'||(prepared.payload->>'sendKey')
 WHERE source.tenant_id=${auth.tenantId} AND source.id=ANY(ARRAY[${sql.join(ids.map(id=>sql`${id}::uuid`),sql`, `)}]) AND (thread.status IN ('pending','failed') OR thread.status='sent' AND EXISTS(SELECT 1 FROM public.events changed WHERE changed.tenant_id=thread.tenant_id AND changed.event_type='COMMUNICATION_SOURCE_CHANGED_V1' AND changed.payload->>'threadId'=thread.id::text))
 ORDER BY source.id,prepared.created_at DESC,prepared.id DESC`);
 return new Map(rows.map(row=>[row.id,{state:row.status==='sent'?'source-changed' as const:row.status==='failed'?'failed' as const:'checking' as const,...(row.deliveryCustomer?{deliveryCustomer:row.deliveryCustomer}:{}),clientRequestId:row.own&&row.version===row.currentVersion?row.clientKey:null,version:row.version,retryAt:iso(row.retryAt)}]));
}

/** Visible waiting state is the real sent thread plus its atomic source receipt, never a local flag. */
export async function readComplaintPhotoWaiting(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,ids:readonly string[]){
 if(!ids.length||!hasAuthorizationArea(auth,'mails'))return new Map<string,{at:string;threadId:string}>();
 const rows=await tx.execute<{id:string;at:string;threadId:string}>(sql`SELECT DISTINCT ON(source.id) source.id::text,event.zeit::text AS at,thread.id::text AS "threadId"
 FROM public.intake_item source JOIN public.intake_event event ON event.tenant_id=source.tenant_id AND event.item_id=source.id AND event.art='anliegen' AND event.nachher->>'action'='reklamation.fotos_angefordert' AND event.nachher->>'customerId'=source.kunde_id AND event.nachher->>'sourceGraphId'=source.graph_message_id
 JOIN public.communication_threads thread ON thread.tenant_id=event.tenant_id AND thread.id::text=event.nachher->>'threadId' AND thread.status='sent' AND thread.source='MS_GRAPH_OUT:'||event.befehl_id::text
 WHERE source.tenant_id=${auth.tenantId} AND source.id=ANY(ARRAY[${sql.join(ids.map(id=>sql`${id}::uuid`),sql`, `)}]) ORDER BY source.id,event.zeit DESC,event.id DESC`);
 return new Map(rows.map(row=>[row.id,{at:row.at,threadId:row.threadId}]));
}
