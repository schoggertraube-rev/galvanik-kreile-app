import { createId } from "@paralleldrive/cuid2";
import { INITIAL_ORDERS } from "@/lib/mockData";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { IndexedDBHelper } from "@/lib/offline/IndexedDBHelper";

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
}

export const ordersRepository = {
  async getAll(): Promise<Order[]> {
    if (typeof window !== "undefined") {
      // 1. If offline, try reading from IndexedDB Read-Cache snapshot
      if (OfflineManager.isOffline()) {
        const cached = await IndexedDBHelper.getSnapshot<Order>("orders");
        if (cached && cached.length > 0) {
          console.log("📴 Loaded orders from IndexedDB cache (Offline Mode)");
          return cached;
        }
      }

      // 2. Fallback to localStorage
      const saved = localStorage.getItem("kreile_orders");
      const orders = saved ? JSON.parse(saved) : INITIAL_ORDERS;
      
      if (!saved) {
        localStorage.setItem("kreile_orders", JSON.stringify(INITIAL_ORDERS));
      }

      // 3. If online, asynchronously update the IndexedDB cache snapshot for next time
      if (!OfflineManager.isOffline()) {
        IndexedDBHelper.saveSnapshot("orders", orders.slice(0, 50)).catch(err =>
          console.error("Failed to save orders snapshot to IndexedDB:", err)
        );
      }

      return orders as Order[];
    }
    return INITIAL_ORDERS as unknown as Order[];
  },

  async create(data: Omit<Order, "id" | "orderNumber" | "status" | "risk">): Promise<Order> {
    const all = await this.getAll();
    const newOrder: Order = {
      ...data,
      id: createId(),
      orderNumber: `A-${202600 + all.length}`,
      status: "in_progress",
      risk: "green"
    };

    const updated = [newOrder, ...all]; // Prepend so it shows up first

    // 1. Handle Offline write queue
    if (OfflineManager.isOffline()) {
      console.log("📴 Offline: Queuing order creation in IndexedDB");
      await OfflineManager.enqueueAction("ORDER_CREATE", data);
      
      // Perform optimistic update locally for instant UI response
      if (typeof window !== "undefined") {
        localStorage.setItem("kreile_orders", JSON.stringify(updated));
      }
      return newOrder;
    }

    // 2. Handle Online standard write
    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_orders", JSON.stringify(updated));
      
      // Update IndexedDB read cache snapshot
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

      // Perform optimistic update locally for instant UI response
      if (typeof window !== "undefined") {
        localStorage.setItem("kreile_orders", JSON.stringify(updated));
        window.dispatchEvent(new Event("storage")); // alert other components
      }
      return updatedOrder;
    }

    // 2. Handle Online standard write
    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_orders", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage")); // alert other components
      
      // Update IndexedDB read cache snapshot
      IndexedDBHelper.saveSnapshot("orders", updated.slice(0, 50)).catch(err =>
        console.error("Failed to update orders snapshot:", err)
      );
    }

    return updatedOrder;
  }
};

