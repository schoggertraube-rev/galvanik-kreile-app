'use server';

import { createHash, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { auditLog, events, items, orders } from '@/db/schema';
import { canTransitionOrderStatus, normalizeStoredOrderStatus, parseOrderStation } from '@/lib/orders/orderMutationContract';
import { getHomogeneousTerminalRoute } from '@/lib/orders/orderRouting';
import {
  getHandoverEventType,
  parseCompleteHandoverInput,
  type CompleteHandoverInput,
  type HandoverMethod,
} from '@/lib/orders/shipmentContract';
import { resolveAuthorization } from '@/lib/server/authorization';
import { invalidateOperationalOrdersCache } from '@/lib/server/operationalOrders';

const TENANT_ID = 'galvanik-kreile';

export type HandoverReceipt = {
  requestId: string;
  orderId: string;
  eventId: string;
  eventType: 'SHIPMENT_SENT' | 'CUSTOMER_PICKUP';
  method: HandoverMethod;
  reference: string;
  requestHash: string;
  confirmedAt: string;
  replayed: boolean;
};

export type HandoverResult =
  | { ok: true; data: HandoverReceipt }
  | { ok: false; error: 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_INPUT' | 'NOT_FOUND' | 'CONFLICT' | 'STORAGE_UNAVAILABLE'; message: string };

function failure(error: Exclude<HandoverResult, { ok: true }>['error'], message: string): HandoverResult {
  return { ok: false, error, message };
}

function requestHash(input: CompleteHandoverInput): string {
  return createHash('sha256').update(JSON.stringify({
    contractVersion: 1,
    orderId: input.orderId,
    method: input.method,
    reference: input.reference,
    carrier: input.carrier || null,
    recipient: input.recipient || null,
    note: input.note || null,
  })).digest('hex');
}

function replayReceipt(row: {
  id: string;
  orderId: string;
  eventType: string;
  payload: Record<string, unknown> | null;
  userId: string | null;
}, actorId: string, input: CompleteHandoverInput, hash: string): HandoverReceipt {
  const payload = row.payload;
  const expectedType = getHandoverEventType(input.method);
  if (!payload || row.userId !== actorId || row.orderId !== input.orderId || row.eventType !== expectedType
    || payload.contractVersion !== 1 || payload.requestHash !== hash || payload.method !== input.method
    || payload.reference !== input.reference || (payload.carrier ?? null) !== (input.carrier ?? null)
    || (payload.recipient ?? null) !== (input.recipient ?? null) || (payload.note ?? null) !== (input.note ?? null)
    || typeof payload.confirmedAt !== 'string') {
    throw new Error('REQUEST_CONFLICT');
  }
  return {
    requestId: input.clientRequestId,
    orderId: input.orderId,
    eventId: row.id,
    eventType: expectedType,
    method: input.method,
    reference: input.reference,
    requestHash: hash,
    confirmedAt: payload.confirmedAt,
    replayed: true,
  };
}

function mapFailure(error: unknown): HandoverResult {
  const code = error instanceof Error ? error.message : '';
  if (code === 'ORDER_NOT_FOUND') return failure('NOT_FOUND', 'Auftrag wurde im angemeldeten Mandanten nicht gefunden.');
  if (code === 'REQUEST_CONFLICT') return failure('CONFLICT', 'Diese Anforderungs-ID wurde bereits mit anderen Übergabedaten verwendet.');
  if (code === 'ORDER_NOT_AT_WARENAUSGANG') return failure('CONFLICT', 'Der Auftrag befindet sich nicht bestätigbar im Warenausgang.');
  if (code === 'ORDER_NOT_HANDOVER_READY') return failure('CONFLICT', 'Der Warenausgang wurde nicht als laufend gestartet. Bitte Auftrag neu laden und Station starten.');
  if (code === 'ORDER_WITHOUT_ITEMS') return failure('CONFLICT', 'Ein Auftrag ohne bestätigte Positionen kann nicht übergeben werden.');
  if (code === 'ITEM_STATION_DIVERGENCE') return failure('CONFLICT', 'Nicht alle Auftragspositionen sind im Warenausgang angekommen.');
  if (code === 'POSITION_ROUTE_REQUIRES_UNIT_ENGINE') return failure('CONFLICT', 'Die versionierte Positionsroute ist nicht einheitlich am Endpunkt bestätigt.');
  if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
    return failure('CONFLICT', 'Diese Anforderungs-ID wurde bereits verwendet. Bitte Auftrag neu laden.');
  }
  console.error('Handover completion failed', error);
  return failure('STORAGE_UNAVAILABLE', 'Übergabe konnte nicht atomar aus der Datenbank bestätigt werden.');
}

export async function completeOrderHandover(value: unknown): Promise<HandoverResult> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return failure('UNAUTHORIZED', 'Anmeldung erforderlich.');
  if (authorization.data.tenantId !== TENANT_ID || !authorization.data.permissions.includes('perm_op_status')) {
    return failure('FORBIDDEN', 'Keine Berechtigung zum Abschluss des Warenausgangs.');
  }

  let input: CompleteHandoverInput;
  try {
    input = parseCompleteHandoverInput(value);
  } catch {
    return failure('INVALID_INPUT', 'Übergabeart, Belegreferenz und ausdrückliche Bestätigung sind erforderlich.');
  }
  const hash = requestHash(input);

  try {
    const receipt = await db.transaction(async (tx) => {
      const [order] = await tx.select({
        id: orders.id,
        station: orders.station,
        currentStationId: orders.currentStationId,
        status: orders.status,
      }).from(orders).where(and(
        eq(orders.id, input.orderId),
        eq(orders.tenantId, authorization.data.tenantId),
      )).limit(1).for('update');
      if (!order) throw new Error('ORDER_NOT_FOUND');

      const [existing] = await tx.select({
        id: events.id,
        orderId: events.orderId,
        eventType: events.eventType,
        payload: events.payload,
        userId: events.userId,
      }).from(events).where(and(
        eq(events.tenantId, authorization.data.tenantId),
        eq(events.clientEventId, input.clientRequestId),
      )).limit(1);
      if (existing) return replayReceipt(existing, authorization.data.userId, input, hash);

      try {
        if (parseOrderStation(order.currentStationId || order.station) !== 'warenausgang') {
          throw new Error('ORDER_NOT_AT_WARENAUSGANG');
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'ORDER_NOT_AT_WARENAUSGANG') throw error;
        throw new Error('ORDER_NOT_AT_WARENAUSGANG');
      }
      const status = normalizeStoredOrderStatus(order.status);
      if (status !== 'in_progress' || !canTransitionOrderStatus(status, 'shipped')) {
        throw new Error('ORDER_NOT_HANDOVER_READY');
      }

      const orderItems = await tx.select({
        currentStationId: items.currentStationId,
        stationSequence: items.stationSequence,
        currentStep: items.currentStep,
      }).from(items).where(and(
        eq(items.orderId, order.id),
        eq(items.tenantId, authorization.data.tenantId),
      )).for('update');
      const route = getHomogeneousTerminalRoute(orderItems, 'warenausgang');
      if (!route.ok) throw new Error(route.conflict);

      const confirmedAt = new Date().toISOString();
      const eventType = getHandoverEventType(input.method);
      const [persistedOrder] = await tx.update(orders).set({
        status: 'shipped',
        completedDate: new Date(confirmedAt),
      }).where(and(
        eq(orders.id, order.id),
        eq(orders.tenantId, authorization.data.tenantId),
      )).returning({ id: orders.id });
      if (!persistedOrder) throw new Error('ORDER_NOT_FOUND');

      const [event] = await tx.insert(events).values({
        id: randomUUID(),
        tenantId: authorization.data.tenantId,
        clientEventId: input.clientRequestId,
        orderId: order.id,
        eventType,
        station: 'warenausgang',
        description: input.method === 'shipment'
          ? `Physische Übergabe an ${input.carrier} bestätigt`
          : `Abholung durch ${input.recipient} bestätigt`,
        payload: {
          contractVersion: 1,
          requestHash: hash,
          method: input.method,
          reference: input.reference,
          carrier: input.carrier ?? null,
          recipient: input.recipient ?? null,
          note: input.note ?? null,
          confirmedAt,
          routeContractVersion: route.data.snapshot.contractVersion,
          routeTemplateId: route.data.snapshot.templateId,
          completedStep: route.data.completedStep,
        },
        status: 'success',
        userId: authorization.data.userId,
      }).returning({ id: events.id });
      if (!event) throw new Error('EVENT_NOT_STORED');

      await tx.insert(auditLog).values({
        tenantId: authorization.data.tenantId,
        clientRequestId: input.clientRequestId,
        action: 'order_handover_completed',
        tableName: 'events',
        recordId: event.id,
        actorId: authorization.data.userId,
        payload: {
          order_id: order.id,
          event_type: eventType,
          method: input.method,
          reference: input.reference,
        },
      });

      return {
        requestId: input.clientRequestId,
        orderId: order.id,
        eventId: event.id,
        eventType,
        method: input.method,
        reference: input.reference,
        requestHash: hash,
        confirmedAt,
        replayed: false,
      } satisfies HandoverReceipt;
    });

    invalidateOperationalOrdersCache();
    try {
      revalidatePath('/');
      revalidatePath('/orders');
      revalidatePath('/warendurchlauf');
      revalidatePath('/warendurchlauf/warenausgang');
    } catch {
      // Revalidation is unavailable in isolated service tests.
    }
    return { ok: true, data: receipt };
  } catch (error) {
    return mapFailure(error);
  }
}
