import { OfflineManager } from "@/lib/offline/OfflineManager";
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

// Timeline aggregation currently has no verified cross-domain ownership and
// receipt contract. It must fail visibly instead of rendering “no history”.
function isTimelineRepositoryEnabled(): boolean {
  return false;
}

function timelineRepositoryUnavailable(): never {
  throw new Error("NOT_CONFIGURED: Die Verlaufshistorie ist bis zum geprüften Datenvertrag nicht freigegeben.");
}

export const timelineRepository = {
  /**
   * Generiert einen aggregierten Zeitstrahl für einen Kunden aus Events, Aufträgen und Reklamationen
   */
  async getForCustomer(customerId: string): Promise<TimelineEntry[]> {
    if (!isTimelineRepositoryEnabled()) return timelineRepositoryUnavailable();

    if (OfflineManager.isOffline()) return [];
    try {
      const result = await getTimelineForCustomerDb(customerId);
      if (!result.ok) {
        console.error("timelineRepository.getForCustomer error:", result.message);
        return [];
      }
      return result.data as TimelineEntry[];
    } catch (err) {
      console.error("Error fetching customer timeline:", err);
      return [];
    }
  },
  
  async getForOrder(orderId: string): Promise<TimelineEntry[]> {
    if (!isTimelineRepositoryEnabled()) return timelineRepositoryUnavailable();

    if (OfflineManager.isOffline()) return [];
    try {
      const result = await getTimelineForOrderDb(orderId);
      if (!result.ok) {
        console.error("timelineRepository.getForOrder error:", result.message);
        return [];
      }
      return result.data as TimelineEntry[];
    } catch (err) {
      console.error("Error fetching order timeline:", err);
      return [];
    }
  },

  async getGlobalTimeline(): Promise<TimelineEntry[]> {
    if (!isTimelineRepositoryEnabled()) return timelineRepositoryUnavailable();

    if (OfflineManager.isOffline()) return [];
    try {
      const result = await getGlobalTimelineDb();
      if (!result.ok) {
        console.error("timelineRepository.getGlobalTimeline error:", result.message);
        return [];
      }
      return result.data as TimelineEntry[];
    } catch (err) {
      console.error("Error fetching global timeline:", err);
      return [];
    }
  }
};
