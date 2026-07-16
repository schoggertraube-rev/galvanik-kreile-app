import { getGlobalTimelineDb, getTimelineForCustomerDb, getTimelineForOrderDb } from "@/app/actions/timeline.actions";

export type TimelineEntry = {
  id: string;
  customerId: string;
  orderId?: string;
  itemId?: string;
  type:
    | "order"
    | "status"
    | "photo"
    | "document"
    | "communication"
    | "price"
    | "complaint"
    | "stock"
    | "bath"
    | "note"
    | "customer";
  title: string;
  subtitle?: string;
  timestamp: string;
  severity?: "neutral" | "good" | "watch" | "critical";
  relatedIds?: string[];
};

function unwrap<T>(result: { ok: true; data: T } | { ok: false; message: string; error?: string }): T {
  if (!result.ok) throw new Error(`${result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN" ? "AUTH_ERROR" : "DATA_ERROR"}: ${result.message}`);
  return result.data;
}

export const timelineRepository = {
  /**
   * Generiert einen aggregierten Zeitstrahl für einen Kunden aus Events, Aufträgen und Reklamationen
   */
  async getForCustomer(customerId: string): Promise<TimelineEntry[]> {
    return unwrap(await getTimelineForCustomerDb(customerId)) as TimelineEntry[];
  },
  
  async getForOrder(orderId: string): Promise<TimelineEntry[]> {
    return unwrap(await getTimelineForOrderDb(orderId)) as TimelineEntry[];
  },

  async getGlobalTimeline(): Promise<TimelineEntry[]> {
    return unwrap(await getGlobalTimelineDb()) as TimelineEntry[];
  }
};
