import { ordersRepository } from "../repositories/ordersRepository";
import { eventsRepository } from "../repositories/eventsRepository";
import { photoService } from "./photoService";

export const intakeService = {
  async processIntake(data: {
    customerId: string | null;
    orderTitle: string;
    items: { name: string; quantity: number; surfaceRequested?: string; photo?: string }[];
  }) {
    const customerId = data.customerId;
    if (!customerId) {
      throw new Error("Vor der Auftragserfassung muss ein echter Kunde ausgewählt oder im Kundenmodul gespeichert werden.");
    }
    if (!data.orderTitle.trim() || data.items.length === 0) {
      throw new Error("Auftragstitel und mindestens ein Teil sind erforderlich.");
    }

    const orderParts = data.items.map((item) => {
      const name = item.name.trim();
      if (!name || !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
        throw new Error("Alle Auftragsteile benötigen eine Bezeichnung und eine gültige ganze Stückzahl.");
      }
      const surfaceRequested = item.surfaceRequested?.trim();
      return {
        name,
        quantity: item.quantity,
        ...(surfaceRequested ? { surfaceRequested } : {}),
      };
    });

    const order = await ordersRepository.create({
      customerId,
      title: data.orderTitle.trim(),
      parts: orderParts,
      source: "manual",
    });

    for (const [index, item] of data.items.entries()) {
      if (item.photo) {
        const persistedItemId = order.parts[index]?.id;
        if (typeof persistedItemId !== "string") {
          throw new Error(`Auftrag ${order.orderNumber} wurde angelegt, aber die Teilebestätigung für das Foto fehlt.`);
        }
        try {
          await photoService.savePhotoForItem(persistedItemId, order.id, item.photo);
        } catch {
          throw new Error(`Auftrag ${order.orderNumber} wurde angelegt, das Foto für Position ${index + 1} aber nicht bestätigt.`);
        }
      }
    }

    try {
      await eventsRepository.addEvent({ eventType: "ITEM_COUNT_CONFIRMED", orderId: order.id });
      await eventsRepository.addEvent({ eventType: "WARENEINGANG_COMPLETED", orderId: order.id });
    } catch {
      throw new Error(`Auftrag ${order.orderNumber} wurde angelegt, der Wareneingangsabschluss aber nicht vollständig bestätigt.`);
    }
    
    // Dispatch global event so listeners (like Warendurchlauf Leitstand) reload the orders
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("kreile-orders-updated"));
    }
    
    return order;
  }
};
