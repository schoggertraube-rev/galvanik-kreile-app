import { createStatusEvent, getRecentStatusEvents } from "@/app/actions/status-events.actions";
import type {
  DocumentaryOperationalEventType,
  OperationalEventMetadata,
  PersistedOperationalEventType,
} from "@/lib/events/operationalEventContract";

export type StatusEventType = PersistedOperationalEventType;

export type StatusEvent = {
  id: string;
  clientEventId: string | null;
  orderId: string;
  itemId?: string;
  eventType: StatusEventType;
  timestamp: string;
  metadata?: OperationalEventMetadata;
};

export type NewStatusEvent = {
  orderId: string;
  itemId?: string;
  eventType: DocumentaryOperationalEventType;
  metadata?: OperationalEventMetadata;
};

function eventError(error: string, message: string): Error {
  return new Error(`${error}: ${message}`);
}

export const eventsRepository = {
  async getAll(): Promise<StatusEvent[]> {
    const result = await getRecentStatusEvents(100);
    if (!result.ok) throw eventError(result.error, result.message);
    return result.data.map((event) => ({
      id: event.id,
      clientEventId: event.clientEventId,
      orderId: event.orderId,
      ...(event.itemId ? { itemId: event.itemId } : {}),
      eventType: event.eventType,
      timestamp: event.createdAt,
      ...(event.metadata ? { metadata: event.metadata } : {}),
    }));
  },

  async addEvent(event: NewStatusEvent): Promise<StatusEvent> {
    const result = await createStatusEvent({
      clientEventId: crypto.randomUUID(),
      orderId: event.orderId,
      ...(event.itemId ? { itemId: event.itemId } : {}),
      eventType: event.eventType,
      ...(event.metadata ? { metadata: event.metadata } : {}),
    });
    if (!result.ok) throw eventError(result.error, result.message);
    return {
      id: result.data.id,
      clientEventId: result.data.clientEventId,
      orderId: result.data.orderId,
      ...(result.data.itemId ? { itemId: result.data.itemId } : {}),
      eventType: result.data.eventType,
      timestamp: result.data.createdAt,
      ...(result.data.metadata ? { metadata: result.data.metadata } : {}),
    };
  },
};
