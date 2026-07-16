import { ordersRepository } from "../repositories/ordersRepository";
import { isRouteTemplateId, type RouteTemplateId } from "@/lib/orders/routeSnapshot";

export const intakeService = {
  async processIntake(data: {
    customerId: string | null;
    clientRequestId: string;
    routeTemplateId: RouteTemplateId;
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
    if (!isRouteTemplateId(data.routeTemplateId)) {
      throw new Error("Vor der Auftragserstellung muss eine bestätigte Positionsroute ausgewählt werden.");
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
        routeTemplateId: data.routeTemplateId,
      };
    });

    const order = await ordersRepository.create({
      clientRequestId: data.clientRequestId,
      customerId,
      title: data.orderTitle.trim(),
      parts: orderParts,
      source: "manual",
    });

    // Photos and Wareneingangs-Abschluss need their own atomic receipts. This
    // intake operation confirms only order + initial items + route snapshot.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("kreile-orders-updated"));
    }
    return order;
  },
};
