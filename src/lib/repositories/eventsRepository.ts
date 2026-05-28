import { createId } from "@paralleldrive/cuid2";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { createClient } from "@/lib/supabase/client";

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

const isSupabase = process.env.NEXT_PUBLIC_DATA_PROVIDER === 'supabase';

// RLS-Hinweis:
// Diese Tabelle muss auf INSERT+SELECT beschränkt werden. (Append-Only Log)

export const eventsRepository = {
  async getAll(): Promise<StatusEvent[]> {
    if (isSupabase) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('status_events')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        console.error("Supabase eventsRepository.getAll error:", error);
        throw error;
      }

      return data.map(e => ({
        id: e.id,
        orderId: e.order_id || undefined,
        itemId: e.item_id || undefined,
        customerId: e.customer_id || undefined,
        eventType: e.event_type as StatusEventType,
        timestamp: e.timestamp,
        metadata: e.metadata || undefined
      })) as StatusEvent[];
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
      const supabase = createClient();
      
      const dbEvent = {
        id: newId,
        order_id: event.orderId || null,
        item_id: event.itemId || null,
        customer_id: event.customerId || null,
        event_type: event.eventType,
        metadata: event.metadata || null,
        timestamp
      };

      const { error } = await supabase.from('status_events').insert(dbEvent);
      if (error) {
        console.error("Supabase eventsRepository.addEvent error:", error);
        throw error;
      }

      return {
        ...event,
        id: newId,
        timestamp
      };
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
