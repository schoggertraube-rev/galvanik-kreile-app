import { customersRepository } from "../repositories/customersRepository";
import { ordersRepository } from "../repositories/ordersRepository";
import { itemsRepository } from "../repositories/itemsRepository";
import { eventsRepository } from "../repositories/eventsRepository";

export const intakeService = {
  async processIntake(data: {
    customerId: string | null;
    newCustomerName?: string;
    orderTitle: string;
    items: { name: string; quantity: number; surfaceRequested?: string }[];
  }) {
    await eventsRepository.addEvent({ eventType: "ORDER_CREATED_MANUAL" });

    // 1. Kunde zuordnen oder anlegen
    let customerId = data.customerId;
    if (!customerId) {
      if (!data.newCustomerName) throw new Error("Kein Kunde angegeben");
      const newCust = await customersRepository.create({
        name: data.newCustomerName
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
      parts: data.items 
    });
    await eventsRepository.addEvent({ eventType: "ORDER_CREATED_MANUAL", orderId: order.id, customerId });

    // 3. Teile zuordnen
    const itemsData = data.items.map(i => ({
      orderId: order.id,
      name: i.name,
      quantity: i.quantity,
      surfaceRequested: i.surfaceRequested
    }));
    await itemsRepository.createMany(itemsData);
    await eventsRepository.addEvent({ eventType: "ITEM_COUNT_CONFIRMED", orderId: order.id });

    // 4. Abschluss
    await eventsRepository.addEvent({ eventType: "WARENEINGANG_COMPLETED", orderId: order.id });
    
    return order;
  }
};
