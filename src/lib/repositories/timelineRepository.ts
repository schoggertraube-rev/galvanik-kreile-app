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
      const eventTitleMap: Record<string, string> = {
        "OCR_SCAN_STARTED": "KI-Scan gestartet",
        "OCR_SCAN_COMPLETED": "KI-Scan abgeschlossen",
        "DOCUMENT_CAPTURED": "Dokument erfasst",
        "CUSTOMER_MATCHED": "Kunde zugeordnet",
        "ORDER_CREATED_FROM_SCAN": "Auftrag per Scan angelegt",
        "ORDER_CREATED_MANUAL": "Auftrag manuell angelegt",
        "ITEMS_SUGGESTED_FROM_SCAN": "Bauteile aus Scan vorgeschlagen",
        "ITEM_COUNT_CONFIRMED": "Bauteile bestätigt",
        "PHOTO_CAPTURED": "Foto aufgenommen",
        "LABEL_PREPARED": "Etikett vorbereitet",
        "WARENEINGANG_COMPLETED": "Wareneingang abgeschlossen",
        "STATION_STARTED": "Station begonnen",
        "STATION_COMPLETED": "Station abgeschlossen",
        "QUALITY_CHECK_PASSED": "Qualitätsprüfung bestanden",
        "QUALITY_CHECK_FAILED": "Qualitätsprüfung fehlgeschlagen",
        "REWORK_STARTED": "Nacharbeit begonnen",
        "SHIPMENT_PREPARED": "Versand vorbereitet",
        "SHIPMENT_SENT": "Versand erfolgt",
        "CUSTOMER_PICKUP": "Abholung durch Kunde",
        "NOTE_ADDED": "Notiz hinzugefügt",
        "COSTS_BOOKED": "Kosten gebucht"
      };

      const title = eventTitleMap[e.eventType] || e.eventType;
      
      if (e.eventType === "ORDER_CREATED_MANUAL" || e.eventType === "ORDER_CREATED_FROM_SCAN") severity = "good";
      if (e.eventType === "PHOTO_CAPTURED") severity = "neutral"; // handled by icon later
      if (e.eventType.includes("COMPLETED") || e.eventType.includes("PASSED")) severity = "good";
      if (e.eventType.includes("FAILED")) severity = "critical";

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
      
      const eventTitleMap: Record<string, string> = {
        "OCR_SCAN_STARTED": "KI-Scan gestartet",
        "OCR_SCAN_COMPLETED": "KI-Scan abgeschlossen",
        "DOCUMENT_CAPTURED": "Dokument erfasst",
        "CUSTOMER_MATCHED": "Kunde zugeordnet",
        "ORDER_CREATED_FROM_SCAN": "Auftrag per Scan angelegt",
        "ORDER_CREATED_MANUAL": "Auftrag manuell angelegt",
        "ITEMS_SUGGESTED_FROM_SCAN": "Bauteile aus Scan vorgeschlagen",
        "ITEM_COUNT_CONFIRMED": "Bauteile bestätigt",
        "PHOTO_CAPTURED": "Foto aufgenommen",
        "LABEL_PREPARED": "Etikett vorbereitet",
        "WARENEINGANG_COMPLETED": "Wareneingang abgeschlossen",
        "STATION_STARTED": "Station begonnen",
        "STATION_COMPLETED": "Station abgeschlossen",
        "QUALITY_CHECK_PASSED": "Qualitätsprüfung bestanden",
        "QUALITY_CHECK_FAILED": "Qualitätsprüfung fehlgeschlagen",
        "REWORK_STARTED": "Nacharbeit begonnen",
        "SHIPMENT_PREPARED": "Versand vorbereitet",
        "SHIPMENT_SENT": "Versand erfolgt",
        "CUSTOMER_PICKUP": "Abholung durch Kunde",
        "NOTE_ADDED": "Notiz hinzugefügt",
        "COSTS_BOOKED": "Kosten gebucht"
      };

      const title = eventTitleMap[e.eventType] || e.eventType;

      if (e.eventType === "ORDER_CREATED_MANUAL" || e.eventType === "ORDER_CREATED_FROM_SCAN") severity = "good";
      if (e.eventType.includes("COMPLETED") || e.eventType.includes("PASSED")) severity = "good";
      if (e.eventType.includes("FAILED")) severity = "critical";
      
      let subtitle = "";
      if (e.metadata) {
        if (e.metadata.stationId) subtitle += `Station: ${e.metadata.stationId} `;
        if (e.metadata.notes) subtitle += `Notiz: ${e.metadata.notes} `;
        if (e.metadata.material) subtitle += `(${e.metadata.material}: ${e.metadata.amount}) `;
      }

      return {
        id: e.id,
        customerId: e.customerId || "unknown",
        orderId: e.orderId,
        type: "status" as const,
        title,
        subtitle: subtitle.trim() || undefined,
        timestamp: e.timestamp,
        severity
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
};
