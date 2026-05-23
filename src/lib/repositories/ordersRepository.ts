import { createId } from "@paralleldrive/cuid2";
import { INITIAL_ORDERS } from "@/lib/mockData";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { IndexedDBHelper } from "@/lib/offline/IndexedDBHelper";
import { createOrderDb, getOrdersDb, updateOrderDb } from "@/app/actions/orders.actions";

export type Order = {
  id: string;
  orderNumber: string;
  customerId: string;
  title: string;
  station: string; 
  status: string;
  risk: string; 
  currentStationId?: string;
  dueDate?: string;
  parts: Record<string, unknown>[];
  statusText?: string;
  delayReason?: string;
  recommendedAction?: string;
  dueLabel?: string;
  dueValue?: string;
  intakeDate?: string;
  task?: string;
  customerName?: string;
}

export const ordersRepository = {
  async getAll(): Promise<Order[]> {
    if (typeof window !== "undefined") {
      // 1. If online, try fetching from Supabase DB first
      if (!OfflineManager.isOffline()) {
        try {
          const dbOrders = await getOrdersDb();
          if (dbOrders && dbOrders.length > 0) {
            localStorage.setItem("kreile_orders", JSON.stringify(dbOrders));
            IndexedDBHelper.saveSnapshot("orders", dbOrders.slice(0, 50)).catch(err =>
              console.error("Failed to save orders snapshot to IndexedDB:", err)
            );
            return dbOrders as Order[];
          }
        } catch (error) {
          console.warn("Failed to fetch orders from Supabase, falling back to cache:", error);
        }
      }

      // 2. If offline or error, try reading from IndexedDB Read-Cache snapshot
      if (OfflineManager.isOffline()) {
        const cached = await IndexedDBHelper.getSnapshot<Order>("orders");
        if (cached && cached.length > 0) {
          console.log("📴 Loaded orders from IndexedDB cache (Offline Mode)");
          return cached;
        }
      }

      // 3. Fallback to localStorage
      const saved = localStorage.getItem("kreile_orders");
      const orders = saved ? JSON.parse(saved) : INITIAL_ORDERS;
      
      if (!saved) {
        localStorage.setItem("kreile_orders", JSON.stringify(INITIAL_ORDERS));
      }

      // 4. If online, update the IndexedDB cache snapshot for next time
      if (!OfflineManager.isOffline()) {
        IndexedDBHelper.saveSnapshot("orders", orders.slice(0, 50)).catch(err =>
          console.error("Failed to save orders snapshot to IndexedDB:", err)
        );
      }

      return orders as Order[];
    }
    return INITIAL_ORDERS as unknown as Order[];
  },

  async create(data: Omit<Order, "id" | "orderNumber" | "status" | "risk"> & { id?: string }): Promise<Order> {
    const all = await this.getAll();
    const orderNumber = `A-${202600 + all.length}`;
    
    // Default dates
    const intakeDate = new Date().toISOString();
    const dueDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const dueLabel = "Fällig in";
    const dueValue = "10 Tagen";
    
    // Map parts with high precision format T-A-2026XX-Y
    const cleanOrderNum = String(202600 + all.length);
    const mappedParts = (data.parts || []).map((part: any, index: number) => {
      const partNum = index + 1;
      const generatedPartId = `T-A-${cleanOrderNum}-${partNum}`;
      return {
        id: part.id || generatedPartId,
        name: part.name,
        quantity: typeof part.quantity === "number" ? part.quantity : parseInt(String(part.quantity)) || 1,
        surfaceRequested: part.surfaceRequested || "",
        status: part.status || "in_progress",
        station: part.station || data.currentStationId || "wareneingang"
      };
    });

    let customerName = "Unbekannter Kunde";
    try {
      const savedCustomers = localStorage.getItem("kreile_customers");
      if (savedCustomers) {
        const customers = JSON.parse(savedCustomers);
        const customer = customers.find((c: any) => c.id === data.customerId);
        if (customer) {
          customerName = customer.name;
        }
      }
    } catch (e) {
      console.warn("Failed to find customerName in local storage lookup", e);
    }

    const newOrder: Order = {
      ...data,
      id: data.id || createId(),
      orderNumber,
      customerName,
      status: "in_progress",
      risk: "green",
      intakeDate,
      dueDate,
      dueLabel,
      dueValue,
      parts: mappedParts
    };

    const updated = [newOrder, ...all];

    // 1. Handle Offline write queue
    if (OfflineManager.isOffline()) {
      console.log("📴 Offline: Queuing order creation in IndexedDB");
      await OfflineManager.enqueueAction("ORDER_CREATE", data);
      
      if (typeof window !== "undefined") {
        localStorage.setItem("kreile_orders", JSON.stringify(updated));
      }
      return newOrder;
    }

    // 2. Handle Online standard write to Supabase
    try {
      const dbOrder = await createOrderDb({
        id: newOrder.id,
        customerId: newOrder.customerId,
        title: newOrder.title,
        parts: newOrder.parts as any,
        currentStationId: newOrder.currentStationId
      });
      if (dbOrder) {
        console.log("⚡ Order created in Supabase:", dbOrder.orderNumber);
        newOrder.orderNumber = dbOrder.orderNumber;
      }
    } catch (error) {
      console.warn("Failed to create order in Supabase, queuing for sync:", error);
      await OfflineManager.enqueueAction("ORDER_CREATE", data);
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_orders", JSON.stringify(updated));
      IndexedDBHelper.saveSnapshot("orders", updated.slice(0, 50)).catch(err =>
        console.error("Failed to update orders snapshot:", err)
      );
    }
    return newOrder;
  },

  async updateOrder(idOrNumber: string, changes: Partial<Order>): Promise<Order | null> {
    const all = await this.getAll();
    let updatedOrder: Order | null = null;

    const updated = all.map(o => {
      if (o.id === idOrNumber || o.orderNumber === idOrNumber) {
        updatedOrder = { ...o, ...changes };
        return updatedOrder;
      }
      return o;
    });

    if (!updatedOrder) return null;

    // 1. Handle Offline write queue
    if (OfflineManager.isOffline()) {
      console.log("📴 Offline: Queuing order status update in IndexedDB");
      await OfflineManager.enqueueAction("ORDER_STATUS_UPDATE", {
        id: (updatedOrder as Order).id,
        orderNumber: (updatedOrder as Order).orderNumber,
        changes
      });

      if (typeof window !== "undefined") {
        localStorage.setItem("kreile_orders", JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));
      }
      return updatedOrder;
    }

    // 2. Handle Online standard write to Supabase
    try {
      const actualId = (updatedOrder as Order).id;
      await updateOrderDb(actualId, {
        status: changes.status,
        currentStationId: changes.currentStationId || changes.station,
        priorityComputed: changes.risk,
        title: changes.title
      });
      console.log("⚡ Order updated in Supabase:", actualId);
    } catch (error) {
      console.warn("Failed to update order in Supabase, queuing for sync:", error);
      await OfflineManager.enqueueAction("ORDER_STATUS_UPDATE", {
        id: (updatedOrder as Order).id,
        orderNumber: (updatedOrder as Order).orderNumber,
        changes
      });
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_orders", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
      
      IndexedDBHelper.saveSnapshot("orders", updated.slice(0, 50)).catch(err =>
        console.error("Failed to update orders snapshot:", err)
      );
    }

    return updatedOrder;
  }
};
