"use server";

import { db } from "@/db";
import { events, orders, customers, complaints } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { ActionResult } from "@/lib/server/authHelper";
import { resolveAuthorization } from "@/lib/server/authorization";
import { TimelineEntry } from "@/lib/repositories/timelineRepository";

export async function getGlobalTimelineDb(): Promise<ActionResult<TimelineEntry[]>> {
  const auth = await resolveAuthorization();
  if (!auth.ok) return { ok: false, error: "UNAUTHORIZED", message: auth.message };

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const entries: TimelineEntry[] = [];
    
    // 1. Letzte Aufträge
    const dbOrders = await db.select({
      id: orders.id,
      customerId: orders.customerId,
      title: orders.title,
      orderNumber: orders.orderNumber,
      createdAt: orders.createdAt
    }).from(orders).where(eq(orders.tenantId, auth.data.tenantId)).orderBy(desc(orders.createdAt)).limit(20);
    
    dbOrders.forEach(o => {
      entries.push({
        id: o.id,
        customerId: o.customerId || "unknown",
        orderId: o.id,
        type: "order",
        title: `Neuer Auftrag: ${o.title || o.orderNumber}`,
        subtitle: o.orderNumber,
        timestamp: o.createdAt.toISOString(),
        severity: "good"
      });
    });

    // 2. Letzte Statusänderungen
    const dbEvents = await db.select({
      id: events.id,
      customerId: orders.customerId, // Joined from orders since events.customerId might not exist in schema 
      orderId: events.orderId,
      eventType: events.eventType,
      createdAt: events.createdAt
    }).from(events)
      .leftJoin(orders, eq(events.orderId, orders.id))
      .where(and(
        eq(events.tenantId, auth.data.tenantId),
        eq(orders.tenantId, auth.data.tenantId),
      ))
      .orderBy(desc(events.createdAt))
      .limit(20);
      
    dbEvents.forEach(e => {
      let severity: TimelineEntry["severity"] = "neutral";
      if (e.eventType.includes("CREATED") || e.eventType.includes("COMPLETED") || e.eventType.includes("PASSED")) severity = "good";
      if (e.eventType.includes("FAILED") || e.eventType === "COMPLAINT_OPENED") severity = "critical";

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

      entries.push({
        id: e.id,
        customerId: e.customerId || "unknown",
        orderId: e.orderId,
        type: "status",
        title: eventTitleMap[e.eventType] || `Status: ${e.eventType}`,
        timestamp: e.createdAt.toISOString(),
        severity
      });
    });

    // 3. Letzte Kundenanlagen
    const dbCustomers = await db.select({
      id: customers.id,
      name: customers.name,
      createdAt: customers.createdAt
    }).from(customers)
      .where(eq(customers.tenantId, auth.data.tenantId))
      .orderBy(desc(customers.createdAt)).limit(10);
    
    dbCustomers.forEach(c => {
      entries.push({
        id: c.id,
        customerId: c.id,
        type: "customer",
        title: `Neukunde: ${c.name}`,
        timestamp: c.createdAt.toISOString(),
        severity: "good"
      });
    });

    // Zusammenführen & Sortieren
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { ok: true, data: entries };
  } catch (error) {
    console.error("Failed to get global timeline from DB:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Timeline", details: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function getTimelineForCustomerDb(customerId: string): Promise<ActionResult<TimelineEntry[]>> {
  const auth = await resolveAuthorization();
  if (!auth.ok) return { ok: false, error: "UNAUTHORIZED", message: auth.message };

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const entries: TimelineEntry[] = [];
    const [ownedCustomer] = await db.select({ id: customers.id }).from(customers).where(and(
      eq(customers.id, customerId),
      eq(customers.tenantId, auth.data.tenantId),
    )).limit(1);
    if (!ownedCustomer) return { ok: false, error: "EMPTY_RESULT", message: "Kunde nicht gefunden" };
    
    const dbEvents = await db.select({
      id: events.id,
      orderId: events.orderId,
      eventType: events.eventType,
      createdAt: events.createdAt
    }).from(events)
      .leftJoin(orders, eq(events.orderId, orders.id))
      .where(and(
        eq(orders.customerId, customerId),
        eq(orders.tenantId, auth.data.tenantId),
        eq(events.tenantId, auth.data.tenantId),
      ));
      
    dbEvents.forEach(e => {
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
      if (e.eventType === "PHOTO_CAPTURED") severity = "neutral";
      if (e.eventType.includes("COMPLETED") || e.eventType.includes("PASSED")) severity = "good";
      if (e.eventType.includes("FAILED")) severity = "critical";

      entries.push({
        id: e.id,
        customerId: customerId,
        orderId: e.orderId,
        type: "status",
        title: title,
        timestamp: e.createdAt.toISOString(),
        severity
      });
    });

    // 2. Reklamationen
    const dbComplaints = await db.select().from(complaints).where(and(
      eq(complaints.customerId, customerId),
      eq(complaints.tenantId, auth.data.tenantId),
    ));
    dbComplaints.forEach(c => {
      entries.push({
        id: c.id,
        customerId: customerId,
        orderId: c.orderId,
        type: "complaint",
        title: `Reklamation: ${c.reason}`,
        subtitle: c.description,
        timestamp: c.createdAt.toISOString(),
        severity: "critical"
      });
    });

    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { ok: true, data: entries };
  } catch (error) {
    console.error("Failed to get timeline for customer:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Timeline" };
  }
}

export async function getTimelineForOrderDb(orderId: string): Promise<ActionResult<TimelineEntry[]>> {
  const auth = await resolveAuthorization();
  if (!auth.ok) return { ok: false, error: "UNAUTHORIZED", message: auth.message };

  if (!db) return { ok: false, error: "DB_ERROR", message: "Database not available" };
  
  try {
    const dbEvents = await db.select({
      id: events.id,
      orderId: events.orderId,
      customerId: orders.customerId,
      eventType: events.eventType,
      createdAt: events.createdAt,
      payload: events.payload
    }).from(events)
      .leftJoin(orders, eq(events.orderId, orders.id))
      .where(and(
        eq(events.orderId, orderId),
        eq(events.tenantId, auth.data.tenantId),
        eq(orders.tenantId, auth.data.tenantId),
      ));
      
    const entries = dbEvents.map(e => {
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
      const metadata = e.payload;
      if (metadata) {
        const stationId = typeof metadata.stationId === "string" ? metadata.stationId : "";
        const notes = typeof metadata.notes === "string" ? metadata.notes : "";
        const material = typeof metadata.material === "string" ? metadata.material : "";
        const amount = typeof metadata.amount === "string" || typeof metadata.amount === "number"
          ? String(metadata.amount)
          : "";
        if (stationId) subtitle += `Station: ${stationId} `;
        if (notes) subtitle += `Notiz: ${notes} `;
        if (material) subtitle += `(${material}${amount ? `: ${amount}` : ""}) `;
      }

      return {
        id: e.id,
        customerId: e.customerId || "unknown",
        orderId: e.orderId,
        type: "status" as const,
        title,
        subtitle: subtitle.trim() || undefined,
        timestamp: e.createdAt.toISOString(),
        severity
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return { ok: true, data: entries };
  } catch (error) {
    console.error("Failed to get timeline for order:", error);
    return { ok: false, error: "DB_ERROR", message: "Fehler beim Laden der Timeline" };
  }
}
