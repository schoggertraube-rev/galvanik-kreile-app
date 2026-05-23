"use server";

import { db } from "@/db";
import { orders, items, customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

export async function getOrdersDb() {
  if (!db) return [];
  try {
    const dbOrders = await db.select().from(orders);
    const dbItems = await db.select().from(items);
    const dbCustomers = await db.select().from(customers);
    
    return dbOrders.map(o => {
      const orderItems = dbItems.filter(item => item.orderId === o.id);
      const customer = dbCustomers.find(c => c.id === o.customerId);
      const customerName = customer ? customer.name : "Unbekannter Kunde";
      
      const intakeDate = new Date().toISOString();
      const dueDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      const dueLabel = "Fällig in";
      const dueValue = "10 Tagen";
      
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerId: o.customerId || "",
        customerName,
        title: o.title,
        station: o.currentStationId || "wareneingang",
        status: o.status,
        risk: o.priorityComputed || "green",
        currentStationId: o.currentStationId || "wareneingang",
        parts: orderItems.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          surfaceRequested: ""
        })),
        intakeDate,
        dueDate,
        dueLabel,
        dueValue
      };
    });
  } catch (error) {
    console.error("Failed to get orders from DB:", error);
    return [];
  }
}

export async function createOrderDb(data: {
  id?: string;
  customerId: string;
  title: string;
  parts: { id?: string; name: string; quantity: number | string; surfaceRequested?: string }[];
  currentStationId?: string;
}) {
  if (!db) return null;
  try {
    const orderId = data.id || createId();
    const orderNumber = `A-${202600 + Math.floor(Math.random() * 10000)}`;
    
    const newOrder = {
      id: orderId,
      tenantId: "hotel-kreile",
      orderNumber,
      customerId: data.customerId,
      title: data.title,
      currentStationId: data.currentStationId || "wareneingang",
      status: "in_progress",
      priorityComputed: "green",
    };
    
    await db.insert(orders).values(newOrder);
    
    if (data.parts && data.parts.length > 0) {
      const newItems = data.parts.map(p => ({
        id: p.id || createId(),
        tenantId: "hotel-kreile",
        orderId,
        customerId: data.customerId,
        name: p.name,
        quantity: typeof p.quantity === "number" ? p.quantity : parseInt(p.quantity as string) || 1,
        currentStationId: data.currentStationId || "wareneingang"
      }));
      await db.insert(items).values(newItems);
    }
    
    return {
      ...newOrder,
      station: newOrder.currentStationId,
      risk: newOrder.priorityComputed,
      parts: data.parts
    };
  } catch (error) {
    console.error("Failed to create order in DB:", error);
    return null;
  }
}

export async function updateOrderDb(id: string, changes: {
  status?: string;
  currentStationId?: string;
  priorityComputed?: string;
  title?: string;
}) {
  if (!db) return null;
  try {
    const updateData: Record<string, string> = {};
    if (changes.status !== undefined) updateData.status = changes.status;
    if (changes.currentStationId !== undefined) updateData.currentStationId = changes.currentStationId;
    if (changes.priorityComputed !== undefined) updateData.priorityComputed = changes.priorityComputed;
    if (changes.title !== undefined) updateData.title = changes.title;
    
    await db.update(orders).set(updateData).where(eq(orders.id, id));
    
    if (changes.currentStationId !== undefined) {
      await db.update(items).set({ currentStationId: changes.currentStationId }).where(eq(items.orderId, id));
    }
    
    return { id, ...changes };
  } catch (error) {
    console.error("Failed to update order in DB:", error);
    return null;
  }
}
