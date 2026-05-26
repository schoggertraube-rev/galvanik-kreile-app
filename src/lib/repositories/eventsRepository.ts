import { createId } from "@paralleldrive/cuid2";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { createStatusEvent, getRecentStatusEvents } from "@/app/actions/status-events.actions";

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

export const eventsRepository = {
  async getAll(): Promise<StatusEvent[]> {
    if (typeof window !== "undefined") {
      if (!OfflineManager.isOffline()) {
        try {
          const dbEvents = await getRecentStatusEvents(200);
          if (dbEvents && dbEvents.length > 0) {
            // Map the db schema back to the frontend StatusEvent interface
            const mappedEvents: StatusEvent[] = dbEvents.map(e => ({
              id: e.id,
              orderId: e.orderId || undefined,
              itemId: e.itemId || undefined,
              customerId: undefined, // Not in schema directly, adjust if needed
              eventType: e.eventType as StatusEventType,
              timestamp: (e.createdAt as unknown as Date).toISOString(),
              metadata: e.notes ? JSON.parse(e.notes) : undefined
            }));
            localStorage.setItem("kreile_events", JSON.stringify(mappedEvents));
            return mappedEvents;
          }
        } catch (error) {
          console.warn("Failed to fetch events from Supabase, falling back to cache:", error);
        }
      }

      // Offline Fallback
      return JSON.parse(localStorage.getItem("kreile_events") || "[]");
    }
    return [];
  },
  async addEvent(event: Omit<StatusEvent, "id" | "timestamp">) {
    const newEvent: StatusEvent = {
      ...event,
      id: createId(),
      timestamp: getMonotonicTimestamp()
    };
    
    // In-Memory / LocalStorage Mock
    if (typeof window !== "undefined") {
      const existing = JSON.parse(localStorage.getItem("kreile_events") || "[]");
      localStorage.setItem("kreile_events", JSON.stringify([...existing, newEvent]));
    }

    // Live write to Supabase if online
    if (typeof window !== "undefined" && !OfflineManager.isOffline()) {
      try {
        if (event.orderId) {
          await createStatusEvent({
            orderId: event.orderId,
            eventType: event.eventType,
            itemId: event.itemId,
            notes: event.metadata ? JSON.stringify(event.metadata) : undefined
          });
        }
      } catch (error) {
        console.warn("Failed to write StatusEvent to Supabase, ignoring:", error);
      }
    }

    console.log("📝 StatusEvent logged:", newEvent.eventType);
    return newEvent;
  }
};
