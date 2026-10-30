import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

export type DocumentSearchRecord = { id: string; customerId: string; orderId: string | null; customerName: string; orderNumber: string | null; mimeType: string; status: string; content: string; recordedAt: string };
export type MailSearchRecord = { id: string; customerId: string; orderId: string | null; customerName: string; orderNumber: string | null; subject: string; status: string; body: string; direction: string; recordedAt: string };
export type AppointmentSearchRecord = { id: string; customerId: string | null; orderId: string | null; customerName: string | null; orderNumber: string | null; title: string; eventType: string; status: string; startsAt: string };
export type AuxiliarySearchRecords = { documents: DocumentSearchRecord[]; mails: MailSearchRecord[]; appointments: AppointmentSearchRecord[]; exhaustive: boolean };

function timestamp(value: Date | string | null): string {
  const date = value instanceof Date ? value : new Date(value ?? "");
  if (!Number.isFinite(date.getTime())) throw new Error("AUXILIARY_SEARCH_TIME_INVALID");
  return date.toISOString();
}

export async function readAuxiliarySearchRecords(auth: AuthorizationSnapshot): Promise<AuxiliarySearchRecords> {
  if (!auth.permissions.includes("perm_view_leitstand")) throw new Error("AUXILIARY_SEARCH_FORBIDDEN");
  return withPrivilegedTenantTransaction(auth, async (tx) => {
    const [documents, mails, appointments] = await Promise.all([
      tx.execute<{ id:string; customer_id:string; order_id:string|null; customer_name:string; order_number:string|null; file_type:string|null; status:string; extracted_data:unknown; recorded_at:Date|string }>(sql`
        SELECT evidence.source_id AS id, links.customer_id, links.order_id,
          customer.name AS customer_name, orders.order_number,
          evidence.original_mime_type AS file_type,
          CASE WHEN evidence.extraction_state = 'LEGACY_RECORDED' THEN 'ocr_review' ELSE 'secured' END AS status,
          evidence.extracted_data,
          coalesce(evidence.original_secured_at, evidence.recorded_at) AS recorded_at
        FROM private.v_evidence_records_v2 evidence
        CROSS JOIN LATERAL (
          SELECT
            max(target ->> 'targetId') FILTER (WHERE target ->> 'targetType' = 'CUSTOMER') AS customer_id,
            max(target ->> 'targetId') FILTER (WHERE target ->> 'targetType' = 'ORDER') AS order_id
          FROM jsonb_array_elements(evidence.target_links) target
        ) links
        JOIN public.customers customer ON customer.id=links.customer_id AND customer.tenant_id=evidence.tenant_id
        LEFT JOIN public.orders orders ON orders.id=links.order_id AND orders.tenant_id=evidence.tenant_id
        WHERE evidence.tenant_id=${auth.tenantId}
          AND evidence.source_kind='LEGACY_SCAN_UPLOAD'
          AND evidence.integrity_ok IS TRUE
          AND evidence.original_state='LEGACY_RECORDED'
        ORDER BY recorded_at DESC LIMIT 250
      `),
      tx.execute<{ id:string; customer_id:string; order_id:string|null; customer_name:string; order_number:string|null; subject:string|null; status:string|null; body:string|null; direction:string|null; recorded_at:Date|string }>(sql`
        SELECT thread.id, thread.customer_id, thread.order_id, customer.name AS customer_name,
          orders.order_number, thread.subject, thread.status, message.body, message.direction,
          coalesce(message.created_at, thread.created_at) AS recorded_at
        FROM public.communication_threads thread
        JOIN public.customers customer ON customer.id=thread.customer_id AND customer.tenant_id=thread.tenant_id
        LEFT JOIN public.orders orders ON orders.id=thread.order_id AND orders.tenant_id=thread.tenant_id
        LEFT JOIN LATERAL (
          SELECT body, direction, created_at FROM public.communication_messages
          WHERE tenant_id=thread.tenant_id AND thread_id=thread.id ORDER BY created_at DESC LIMIT 1
        ) message ON true
        WHERE thread.tenant_id=${auth.tenantId}
        ORDER BY recorded_at DESC LIMIT 250
      `),
      tx.execute<{ id:string; customer_id:string|null; order_id:string|null; customer_name:string|null; order_number:string|null; title:string; event_type:string; status:string; starts_at:Date|string }>(sql`
        SELECT event.id, event.customer_id, event.order_id, customer.name AS customer_name,
          orders.order_number, event.title, event.event_type, event.status, event.starts_at
        FROM public.calendar_events event
        LEFT JOIN public.customers customer ON customer.id=event.customer_id AND customer.tenant_id=event.tenant_id
        LEFT JOIN public.orders orders ON orders.id=event.order_id AND orders.tenant_id=event.tenant_id
        WHERE event.tenant_id=${auth.tenantId}
        ORDER BY event.starts_at DESC LIMIT 250
      `),
    ]);
    return {
      documents: documents.map((row) => ({ id:row.id, customerId:row.customer_id, orderId:row.order_id, customerName:row.customer_name, orderNumber:row.order_number, mimeType:row.file_type ?? "Dokument", status:row.status, content:row.extracted_data ? JSON.stringify(row.extracted_data).slice(0, 20_000) : "", recordedAt:timestamp(row.recorded_at) })),
      mails: mails.map((row) => ({ id:row.id, customerId:row.customer_id, orderId:row.order_id, customerName:row.customer_name, orderNumber:row.order_number, subject:row.subject?.trim() || "Ohne Betreff", status:row.status?.trim() || "gespeichert", body:row.body?.slice(0, 20_000) ?? "", direction:row.direction?.trim() || "email", recordedAt:timestamp(row.recorded_at) })),
      appointments: appointments.map((row) => ({ id:row.id, customerId:row.customer_id, orderId:row.order_id, customerName:row.customer_name, orderNumber:row.order_number, title:row.title, eventType:row.event_type, status:row.status, startsAt:timestamp(row.starts_at) })),
      exhaustive: documents.length < 250 && mails.length < 250 && appointments.length < 250,
    };
  });
}
