import 'server-only';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { canonicalJson } from '@/lib/domain/canonicalJson';
import { readAppSession } from './appSession';
import { goodsOutSignaturePath, readGoodsOutSignature } from './domainAttachmentStorage';
import type { AuthorizationSnapshot } from './authorization';
import type { PrivilegedTenantTransaction } from './privilegedDb';

const COLLECTOR_EVENT = 'ORDER_GOODS_OUT_COLLECTOR_V1';

export type GoodsOutCollector = {
  art: 'kunde' | 'ansprechpartner' | 'andere';
  name: string;
  kontaktId?: string;
  quelleNachrichtId?: string;
  unterschrift: { storagePath: string; sha256: string; breitePx: number; hoehePx: number };
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

const textId = (value: unknown): value is string => typeof value === 'string'
  && value.length > 0 && value.length <= 128 && value === value.trim();

export function isGoodsOutCollector(value: unknown): value is GoodsOutCollector {
  const collector = record(value);
  const signature = record(collector?.unterschrift);
  return !!collector && !!signature
    && Object.keys(collector).every(key => ['art', 'name', 'kontaktId', 'quelleNachrichtId', 'unterschrift'].includes(key))
    && (collector.art === 'kunde' || collector.art === 'ansprechpartner' || collector.art === 'andere')
    && textId(collector.name) && collector.name.length <= 120
    && (collector.kontaktId === undefined || textId(collector.kontaktId))
    && (collector.quelleNachrichtId === undefined || textId(collector.quelleNachrichtId))
    && Object.keys(signature).length === 4
    && typeof signature.storagePath === 'string'
    && typeof signature.sha256 === 'string' && /^[0-9a-f]{64}$/.test(signature.sha256)
    && typeof signature.breitePx === 'number' && Number.isSafeInteger(signature.breitePx) && signature.breitePx >= 300
    && typeof signature.hoehePx === 'number' && Number.isSafeInteger(signature.hoehePx) && signature.hoehePx >= 120;
}

export async function verifyCollectorSignature(tenantId: string, clientEventId: string, signature: GoodsOutCollector['unterschrift']) {
  const path = goodsOutSignaturePath(tenantId, clientEventId);
  if (signature.storagePath !== path) return false;
  const { width, height } = await readGoodsOutSignature(path, signature.sha256);
  return width === signature.breitePx && height === signature.hoehePx;
}

type Physical = { eventId: string; orderId: string; orderVersion: number; occurredAt: string; correlationId: string };

export async function writeGoodsOutCollector(tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot,
  physical: Physical, collector: GoodsOutCollector): Promise<void> {
  const read = await readAppSession();
  const session = read.ok && read.session.tenantId === auth.tenantId && read.session.userId === auth.userId ? read.session : null;
  const payload = { collector, goodsOutEventId: physical.eventId, occurredAt: physical.occurredAt, device: session?.device ?? null };
  const id = randomUUID();
  try {
    const rows = await tx.execute<{ id: string; payload: unknown }>(sql`INSERT INTO public.events
      (id, tenant_id, order_id, event_type, description, user_id, payload, status, event_schema_version, correlation_id, aggregate_version, created_at)
      VALUES (${id}, ${auth.tenantId}, ${physical.orderId}, ${COLLECTOR_EVENT}, 'Warenausgang gebucht', ${auth.userId}::uuid,
        ${JSON.stringify(payload)}::jsonb, 'success', 1, ${physical.correlationId}::uuid, ${physical.orderVersion},
        ${physical.occurredAt}::timestamptz AT TIME ZONE 'UTC') RETURNING id, payload`);
    if (rows.length !== 1 || rows[0].id !== id || canonicalJson(rows[0].payload) !== canonicalJson(payload)) {
      throw new Error('GOODS_OUT_COLLECTOR_RECEIPT_MISSING');
    }
  } catch {
    // An SQL error may include its bound parameters. Keep the personal data in the private record.
    throw new Error('GOODS_OUT_COLLECTOR_RECEIPT_MISSING');
  }
}

export async function readGoodsOutCollector(tx: PrivilegedTenantTransaction, tenantId: string, orderId: string, goodsOutEventId?: string) {
  const rows = await tx.execute<{ payload: { collector: unknown; occurredAt: string }; request_id: string; occurred_at: string; version: number }>(sql`
    SELECT proof.payload, physical.client_event_id::text AS request_id, physical.aggregate_version AS version,
      to_char(physical.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS occurred_at
    FROM public.events proof JOIN public.events physical ON physical.id = proof.payload->>'goodsOutEventId'
      AND physical.tenant_id = proof.tenant_id AND physical.order_id = proof.order_id AND physical.user_id = proof.user_id
      AND physical.correlation_id = proof.correlation_id AND physical.aggregate_version = proof.aggregate_version
    WHERE proof.tenant_id = ${tenantId} AND proof.order_id = ${orderId} AND proof.event_type = ${COLLECTOR_EVENT}
      AND proof.status = 'success' AND proof.event_schema_version = 1 AND physical.status = 'success'
      AND physical.event_type IN ('ORDER_PICKED_UP_V1', 'ORDER_PICKED_UP_V2', 'ORDER_PICKED_UP_V3', 'ORDER_PICKED_UP_V4')
      AND physical.payload->>'mode' = 'abholung' ${goodsOutEventId ? sql`AND physical.id = ${goodsOutEventId}` : sql``}
    ORDER BY physical.aggregate_version DESC LIMIT 2`);
  if (!rows.length) return null;
  const first = rows[0];
  if (rows[1]?.version === first.version || !isGoodsOutCollector(first.payload.collector)
    || first.payload.occurredAt !== first.occurred_at
    || first.payload.collector.unterschrift.storagePath !== goodsOutSignaturePath(tenantId, first.request_id)) {
    throw new Error('GOODS_OUT_COLLECTOR_RECEIPT_INVALID');
  }
  return { collector: first.payload.collector, occurredAt: first.occurred_at };
}
