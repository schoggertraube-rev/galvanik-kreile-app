import { createId } from "@paralleldrive/cuid2";
import { getRecentStatusEvents, createStatusEvent } from "@/app/actions/status-events.actions";

export type StatusEventType =
  | "OCR_SCAN_STARTED"
  | "OCR_SCAN_COMPLETED"
  | "DOCUMENT_CAPTURED"
  | "CUSTOMER_MATCHED"
  | "ORDER_CREATED_FROM_SCAN"
  | "ORDER_CREATED_MANUAL"
  | "ITEMS_SUGGESTED_FROM_SCAN"
  | "ITEM_COUNT_CONFIRMED"
  | "PHOTO_CAPTURED"
  | "LABEL_PREPARED"
  | "WARENEINGANG_COMPLETED"
  | "STATION_STARTED"
  | "STATION_COMPLETED"
  | "STATION_READY"
  | "QUALITY_CHECK_PASSED"
  | "QUALITY_CHECK_FAILED"
  | "REWORK_STARTED"
  | "SHIPMENT_PREPARED"
  | "SHIPMENT_SENT"
  | "CUSTOMER_PICKUP"
  | "COMPLAINT_OPENED"
  | "COMPLAINT_RESOLVED"
  | "BATH_MEASUREMENT_TAKEN"
  | "BATH_BLOCKED"
  | "BATH_RELEASED"
  | "STOCK_LOW"
  | "STOCK_REPLENISHED"
  | "NOTE_ADDED"
  | "COSTS_BOOKED";

export type StatusEvent = {
  id: string;
  orderId?: string;
  itemId?: string;
  customerId?: string;
  eventType: StatusEventType;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

let lastTimestamp = 0;
function getMonotonicTimestamp(): string {
  let now = Date.now();
  if (now <= lastTimestamp) {
    now = lastTimestamp + 1;
  }
  lastTimestamp = now;
  return new Date(now).toISOString();
}

const isSupabase = process.env.NEXT_PUBLIC_DATA_PROVIDER === 'supabase';

// RLS-Hinweis:
// Diese Tabelle muss auf INSERT+SELECT beschränkt werden. (Append-Only Log)

export const eventsRepository = {
  async getAll(): Promise<StatusEvent[]> {
    if (isSupabase) {
      try {
        const result = await getRecentStatusEvents(100);
        if (!result.ok) {
          if (result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN") {
            throw new Error(`AUTH_ERROR: ${result.message}`);
          }
          console.warn("Drizzle events fallback:", result.message);
          return [];
        }
        
        const data = result.data || [];
        return data.map((e: Record<string, unknown>) => ({
          id: e.id,
          orderId: e.orderId || undefined,
          itemId: e.itemId || undefined,
          eventType: e.eventType as StatusEventType,
          timestamp: e.createdAt,
          metadata: e.payload || (e.notes ? safeParseJson(e.notes as string) : undefined)
        })) as StatusEvent[];
      } catch (error: unknown) {
        if (error instanceof Error && error.message.startsWith("AUTH_ERROR")) {
          throw error;
        }
        console.error("Drizzle eventsRepository.getAll error:", error);
        return []; // Fallback to empty on crash
      }
    }

    // --- Mock Fallback ---
    if (typeof window !== "undefined") {
      return JSON.parse(localStorage.getItem("kreile_events") || "[]");
    }
    return [];
  },

  async addEvent(event: Omit<StatusEvent, "id" | "timestamp">): Promise<StatusEvent> {
    const newId = createId();
    const timestamp = getMonotonicTimestamp();

    if (isSupabase) {
      if (!event.orderId) {
        console.warn(`Skipping DB insert for event '${event.eventType}' because orderId is missing.`);
        return { ...event, id: newId, timestamp };
      }

      try {
        const result = await createStatusEvent({
          orderId: event.orderId,
          itemId: event.itemId,
          eventType: event.eventType,
          notes: event.metadata ? JSON.stringify(event.metadata) : undefined,
          payload: event.metadata,
        });
        
        if (!result.ok) {
          if (result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN") {
            throw new Error(`AUTH_ERROR: ${result.message}`);
          }
        }
        
        return { ...event, id: newId, timestamp };
      } catch (error: unknown) {
        if (error instanceof Error && error.message.startsWith("AUTH_ERROR")) {
          throw error;
        }
        console.error("Drizzle eventsRepository.addEvent error:", error);
        // Fall back to returning without throwing so offline/UI doesn't crash entirely
        return { ...event, id: newId, timestamp };
      }
    }

    // --- Mock Fallback ---
    const newEvent: StatusEvent = {
      ...event,
      id: newId,
      timestamp
    };
    
    if (typeof window !== "undefined") {
      const existing = JSON.parse(localStorage.getItem("kreile_events") || "[]");
      localStorage.setItem("kreile_events", JSON.stringify([...existing, newEvent]));
    }

    console.log("📝 StatusEvent logged (Mock):", newEvent.eventType);
    return newEvent;
  }
};

function safeParseJson(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return { raw: str };
  }
}
