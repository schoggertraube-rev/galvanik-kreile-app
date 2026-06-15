import { customersRepository } from "../repositories/customersRepository";
import { ordersRepository } from "../repositories/ordersRepository";
import { itemsRepository } from "../repositories/itemsRepository";
import { eventsRepository } from "../repositories/eventsRepository";
import { photoService } from "./photoService";

export const intakeService = {
  async processIntake(data: {
    customerId: string | null;
    newCustomerName?: string;
    newCustomerDetails?: Record<string, string>;
    orderTitle: string;
    items: { name: string; quantity: number; surfaceRequested?: string; photo?: string }[];
  }) {
    await eventsRepository.addEvent({ eventType: "ORDER_CREATED_MANUAL" });

    // 1. Kunde zuordnen oder anlegen
    let customerId = data.customerId;
    if (!customerId) {
      // If no new customer name provided, use placeholder
  let newName = data.newCustomerName;
  if (!newName) {
    console.warn("⚠️ Kein Kunde angegeben – erstelle Platzhalterkunde 'Unbekannter Kunde'.");
    newName = "Unbekannter Kunde";
  }
  const details = data.newCustomerDetails || {};

      
      // Merge street and zip/city to address if street exists
      let address = details.address || "";
      if (!address && details.street) {
        address = details.street;
        if (details.zip) {
          address += `, ${details.zip}`;
        }
        if (details.city) {
          address += ` ${details.city}`;
        }
      }

      const newCust = await customersRepository.create({
        name: newName,
        type: "Privatkunde",
        city: details.city || "Unbekannt",
        phone: details.phone || "",
        email: details.email || "",
        prefComm: "Telefon",
        ...details,
        address
      });
      customerId = newCust.id;
      await eventsRepository.addEvent({ eventType: "CUSTOMER_MATCHED", customerId });
    } else {
      await eventsRepository.addEvent({ eventType: "CUSTOMER_MATCHED", customerId });
    }

    // 2. Auftrag erstellen
    const order = await ordersRepository.create({
      customerId,
      title: data.orderTitle,
      station: "wareneingang",
      parts: data.items,
      source: "manual"
    });
    await eventsRepository.addEvent({ eventType: "ORDER_CREATED_MANUAL", orderId: order.id, customerId });

    // 3. Teile zuordnen & Fotos hochladen
    const itemsData = data.items.map(i => ({
      orderId: order.id,
      name: i.name,
      quantity: i.quantity,
      surfaceRequested: i.surfaceRequested,
      photoUrl: i.photo || undefined
    }));
    await itemsRepository.createMany(itemsData);

    // Fotos im Hintergrund an Supabase schicken
    for (const item of data.items) {
      if (item.photo) {
        await photoService.savePhotoForOrder(order.id, item.photo);
      }
    }

    await eventsRepository.addEvent({ eventType: "ITEM_COUNT_CONFIRMED", orderId: order.id });

    // 4. Abschluss
    await eventsRepository.addEvent({ eventType: "WARENEINGANG_COMPLETED", orderId: order.id });
    
    // Dispatch global event so listeners (like Warendurchlauf Leitstand) reload the orders
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("kreile-orders-updated"));
    }
    
    return order;
  }
};
