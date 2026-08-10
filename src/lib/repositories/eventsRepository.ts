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
};

export type EventUnavailable = {
  ok: false;
  error: "NOT_AVAILABLE";
  message: "NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.";
};

const NOT_AVAILABLE = "NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.";

export const eventsRepository = {
  async getAll(): Promise<StatusEvent[]> {
    return [];
  },

  async addEvent(_event: Omit<StatusEvent, "id" | "timestamp">): Promise<EventUnavailable> {
    void _event;
    return { ok: false, error: "NOT_AVAILABLE", message: NOT_AVAILABLE };
  },
};
