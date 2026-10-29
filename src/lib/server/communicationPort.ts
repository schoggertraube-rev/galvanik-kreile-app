import "server-only";

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import {
  listMicrosoftGraphInbox,
  readMicrosoftGraphConfigurationStatus,
  readMicrosoftGraphAttachments,
  readMicrosoftGraphMessage,
  sendMicrosoftGraphMail,
  type GraphInboxMessage,
  type GraphMailAttachment,
} from "@/lib/server/microsoftGraph";
import { importDomainAttachmentBytes } from "@/lib/server/domainAttachment";

type TargetType = "CUSTOMER" | "ORDER";
type Result<T> = { code: "OK"; data: T } | { code: "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT" | "IN_KLAERUNG" | "UNAVAILABLE"; message: string };
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

export type CommunicationReceipt = { threadId: string; messageId: string | null; customerId: string; orderId: string | null; recordedAt: string; replayed: boolean; attachmentsImported?: number; attachmentsSkipped?: number; attachmentWarning?: string };
export type LinkedCommunicationMessage = {
  threadId: string;
  graphMessageId: string;
  subject: string | null;
  body: string | null;
  senderLabel: string | null;
  receivedAt: string;
};

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

async function resolveTarget(auth: AuthorizationSnapshot, type: TargetType, id: string): Promise<Target | null> {
  return withPrivilegedTenantTransaction(auth, async (tx) => {
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
  });
}

export async function readCommunicationInbox(auth: AuthorizationSnapshot): Promise<Result<GraphInboxMessage[]>> {
  if (!canRead(auth)) return { code: "FORBIDDEN", message: "Der Outlook-Eingang ist für diese Rolle nicht freigegeben." };
  return listMicrosoftGraphInbox();
}

export async function readLinkedCommunicationMessages(
  auth: AuthorizationSnapshot,
  input: { targetType: TargetType; targetId: string },
): Promise<Result<LinkedCommunicationMessage[]>> {
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
      return {
        threadId: row.thread_id,
        graphMessageId,
        subject: row.subject?.trim() || null,
        body: row.body?.trim() || null,
        senderLabel: row.summary?.trim() || null,
        receivedAt: iso(row.received_at),
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
  const graph = await readMicrosoftGraphMessage(input.graphMessageId);
  if (graph.code !== "OK") return graph;
  const graphAttachments = graph.data.hasAttachments ? await readMicrosoftGraphAttachments(input.graphMessageId) : { code: "OK" as const, data: { attachments: [], skipped: 0 } };
  if (graphAttachments.code !== "OK") return graphAttachments;
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
          return { code: "CONFLICT" as const, message: "Diese Mail ist bereits einem anderen Vorgang zugeordnet." };
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
    let imported = 0;
    for (const attachment of graphAttachments.data.attachments) {
      const saved = await importDomainAttachmentBytes(auth, {
        targetType: input.targetType, targetId: input.targetId,
        sourceKey: `MS_GRAPH:${graph.data.id}:${attachment.id}`,
        mimeType: attachment.contentType,
        bytes: attachment.bytes,
      });
      if (saved.code === "OK") imported += 1;
    }
    const failed = graphAttachments.data.attachments.length - imported;
    return { code: "OK", data: {
      ...stored.data,
      attachmentsImported: imported,
      attachmentsSkipped: graphAttachments.data.skipped,
      ...(failed > 0 ? { attachmentWarning: `${failed} unterstützte Mailanhänge konnten nicht sicher gespeichert werden.` } : {}),
    } };
  } catch (error) {
    logCommunicationFailure("COMMUNICATION_ATTACH_FAILED", error);
    return { code: "UNAVAILABLE", message: "Die Mail konnte nicht sicher am Vorgang abgelegt werden." };
  }
}

export async function sendCommunicationMail(
  auth: AuthorizationSnapshot,
  input: { targetType: TargetType; targetId: string; clientRequestId: string; subject: string; body: string; attachment?: GraphMailAttachment },
): Promise<Result<CommunicationReceipt>> {
  if (!validTarget(input?.targetType, input?.targetId) || !/^[0-9a-f-]{36}$/i.test(input.clientRequestId) || input.subject.trim().length < 1 || input.subject.length > 500 || input.body.trim().length < 1 || input.body.length > 20_000) {
    return { code: "VALIDATION_ERROR", message: "Empfänger, Betreff oder Nachricht ist ungültig." };
  }
  if (!canWrite(auth)) return { code: "FORBIDDEN", message: "E-Mails dürfen für diese Rolle nicht versendet werden." };
  if (readMicrosoftGraphConfigurationStatus().code !== "READY") {
    return { code: "IN_KLAERUNG", message: "Microsoft 365 ist noch nicht für die Preview verbunden." };
  }
  const target = await resolveTarget(auth, input.targetType, input.targetId).catch((error) => {
    logCommunicationFailure("COMMUNICATION_TARGET_READ_FAILED", error);
    return null;
  });
  if (!target) return { code: "NOT_FOUND", message: "Kunde oder Auftrag ist nicht verfügbar." };
  if (!/^\S+@\S+\.\S+$/.test(target.email)) return { code: "VALIDATION_ERROR", message: "Beim Kunden ist keine gültige E-Mail-Adresse hinterlegt." };
  const source = `MS_GRAPH_OUT:${input.clientRequestId}`;
  let pending: { threadId: string; recordedAt: string; replay?: CommunicationReceipt };
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
        if (existing[0].status !== "sent") throw new Error("COMMUNICATION_OUTCOME_UNCLEAR");
        return { threadId: existing[0].id, recordedAt: iso(existing[0].created_at), replay: { threadId: existing[0].id, messageId: null, customerId: target.customerId, orderId: target.orderId, recordedAt: iso(existing[0].created_at), replayed: true } };
      }
      const threadId = randomUUID();
      const rows = await tx.execute<ThreadRow>(sql`
        INSERT INTO public.communication_threads (id, tenant_id, customer_id, order_id, source, subject, status, priority, category, created_by)
        VALUES (${threadId}, ${auth.tenantId}, ${target.customerId}, ${target.orderId}, ${source}, ${input.subject.trim()}, 'pending', 'normal', 'email', ${auth.userId})
        RETURNING id, customer_id, order_id, status, created_at
      `);
      if (rows.length !== 1 || !rows[0]) throw new Error("COMMUNICATION_THREAD_INSERT_FAILED");
      return { threadId, recordedAt: iso(rows[0].created_at) };
    });
  } catch (error) {
    logCommunicationFailure("COMMUNICATION_SEND_PREPARE_FAILED", error);
    return { code: error instanceof Error && error.message === "COMMUNICATION_OUTCOME_UNCLEAR" ? "CONFLICT" : "UNAVAILABLE", message: error instanceof Error && error.message === "COMMUNICATION_OUTCOME_UNCLEAR" ? "Der Ausgang dieses Versands ist ungeklärt. Nicht erneut senden; zuerst im Outlook-Ausgang prüfen." : "Der Mailversand konnte nicht sicher vorbereitet werden." };
  }
  if (pending.replay) return { code: "OK", data: pending.replay };
  const sent = await sendMicrosoftGraphMail({ to: target.email, subject: input.subject.trim(), body: input.body.trim(), attachment: input.attachment });
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
  try {
    const messageId = randomUUID();
    await withPrivilegedTenantTransaction(auth, async (tx) => {
      const updated = await tx.execute<{ id: string }>(sql`
        UPDATE public.communication_threads SET status='sent', updated_at=statement_timestamp()
        WHERE tenant_id=${auth.tenantId} AND id=${pending.threadId} AND status='pending' RETURNING id
      `);
      if (updated.length !== 1) throw new Error("COMMUNICATION_THREAD_FINALIZE_FAILED");
      const messages = await tx.execute<{ id: string }>(sql`
        INSERT INTO public.communication_messages (id, tenant_id, thread_id, direction, channel, body, summary, created_by)
        VALUES (${messageId}, ${auth.tenantId}, ${pending.threadId}, 'outgoing', 'email', ${input.body.trim()}, ${input.attachment ? `Anhang: ${input.attachment.filename}` : 'Ohne Anhang'}, ${auth.userId}) RETURNING id
      `);
      if (messages.length !== 1 || messages[0]?.id !== messageId) throw new Error("COMMUNICATION_MESSAGE_INSERT_FAILED");
    });
    return { code: "OK", data: { threadId: pending.threadId, messageId, customerId: target.customerId, orderId: target.orderId, recordedAt: pending.recordedAt, replayed: false } };
  } catch (error) {
    logCommunicationFailure("COMMUNICATION_SEND_FINALIZE_FAILED", error);
    return { code: "UNAVAILABLE", message: "Microsoft 365 hat die Mail angenommen, die lokale Vorgangskopie ist aber noch nicht sicher bestätigt. Nicht erneut senden." };
  }
}
