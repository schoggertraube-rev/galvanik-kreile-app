import { eventsRepository, StatusEvent } from "./eventsRepository";
import { complaintsRepository, Complaint } from "./complaintsRepository";

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
    | "note";
  title: string;
  subtitle?: string;
  timestamp: string;
  severity?: "neutral" | "good" | "watch" | "critical";
  relatedIds?: string[];
};

export const timelineRepository = {
  /**
   * Generiert einen aggregierten Zeitstrahl für einen Kunden aus Events, Aufträgen und Reklamationen
   */
  async getForCustomer(customerId: string): Promise<TimelineEntry[]> {
    const entries: TimelineEntry[] = [];
    
    // 1. Hole Status Events aus dem eventsRepository
    const allEvents = await eventsRepository.getAll();
    const customerEvents = allEvents.filter((e: StatusEvent) => e.customerId === customerId || !e.customerId); // simplified mock
    
    customerEvents.forEach((e: StatusEvent) => {
      let severity: TimelineEntry["severity"] = "neutral";
      let title: string = e.eventType;
      
      if (e.eventType === "ORDER_CREATED_MANUAL" || e.eventType === "ORDER_CREATED_FROM_SCAN") { title = "Auftrag angelegt"; severity = "good"; }
      if (e.eventType === "PHOTO_CAPTURED") { title = "Foto aufgenommen"; }
      if (e.eventType === "QUALITY_CHECK_FAILED") { title = "Qualitätsprüfung fehlgeschlagen"; severity = "critical"; }

      entries.push({
        id: e.id,
        customerId: customerId,
        orderId: e.orderId,
        type: "status",
        title: title,
        timestamp: e.timestamp,
        severity
      });
    });

    // 2. Hole Reklamationen
    const complaints = await complaintsRepository.getByCustomer(customerId);
    complaints.forEach((c: Complaint) => {
      entries.push({
        id: c.id,
        customerId: customerId,
        orderId: c.orderId,
        type: "complaint",
        title: `Reklamation: ${c.reason}`,
        subtitle: c.description,
        timestamp: c.createdAt,
        severity: "critical"
      });
    });

    // Sortiere absteigend (neueste zuerst)
    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },
  
  async getForOrder(orderId: string): Promise<TimelineEntry[]> {
    // Hole alle Events für eine Order
    const allEvents = await eventsRepository.getAll();
    const orderEvents = allEvents.filter((e: StatusEvent) => e.orderId === orderId);
    
    return orderEvents.map((e: StatusEvent) => {
      let severity: TimelineEntry["severity"] = "neutral";
      if (e.eventType === "ORDER_CREATED_MANUAL" || e.eventType === "ORDER_CREATED_FROM_SCAN") severity = "good";
      if (e.eventType.includes("COMPLETED")) severity = "good";
      if (e.eventType.includes("FAILED")) severity = "critical";
      
      return {
        id: e.id,
        customerId: e.customerId || "unknown",
        orderId: e.orderId,
        type: "status" as const,
        title: e.eventType,
        subtitle: JSON.stringify(e.metadata || {}),
        timestamp: e.timestamp,
        severity
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
};
