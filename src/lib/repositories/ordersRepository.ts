import { createId } from "@paralleldrive/cuid2";
import { INITIAL_ORDERS } from "@/lib/mockData";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { IndexedDBHelper } from "@/lib/offline/IndexedDBHelper";
import { getOrdersDb, createOrderDb, updateOrderDb } from "@/app/actions/orders.actions";

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
  rawIntakeDate?: string;
  rawDueDate?: string;
  attachmentUrl?: string;
}

const isSupabase = process.env.NEXT_PUBLIC_DATA_PROVIDER === 'supabase';

export const ordersRepository = {
  async getAll(): Promise<Order[]> {
    if (isSupabase) {
      try {
        const result = await getOrdersDb();
        if (!result.ok) {
          if (result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN") {
            throw new Error(`AUTH_ERROR: ${result.message}`);
          }
          console.warn("Drizzle fallback:", result.message);
          throw new Error("NETWORK_ERROR");
        }
        return result.data as unknown as Order[];
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("AUTH_ERROR")) {
          throw error; // hard crash for auth errors
        }
        console.error("Drizzle ordersRepository.getAll error:", error);
        // We throw here so the offline fallback below handles it? 
        // Wait, the offline fallback is in the "Mock Fallback" section which is ONLY reached if isSupabase is false, or if we fallback?
        // Ah, the original code returned [] on error. I should return [] but NOT for auth errors.
        if (error instanceof Error && error.message.startsWith("AUTH_ERROR")) {
          throw error;
        }
        // If not auth error, fallback to offline
      }
    }

    // --- Mock Fallback ---
    if (typeof window !== "undefined") {
      // If offline or error, try reading from IndexedDB Read-Cache snapshot
      if (OfflineManager.isOffline()) {
        const cached = await IndexedDBHelper.getSnapshot<Order>("orders");
        if (cached && cached.length > 0) {
          console.log("📴 Loaded orders from IndexedDB cache (Offline Mode)");
          return cached;
        }
      }

      // Fallback to localStorage
      const saved = localStorage.getItem("kreile_orders");
      const orders = saved ? JSON.parse(saved) : INITIAL_ORDERS;
      
      if (!saved) {
        localStorage.setItem("kreile_orders", JSON.stringify(INITIAL_ORDERS));
      }

      // Update the IndexedDB cache snapshot for next time
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
    const intakeDate = new Date().toISOString();
    const dueDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    
    if (isSupabase) {
      try {
        const result = await createOrderDb(data as Record<string, unknown>);
        if (!result.ok) {
          if (result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN") {
            throw new Error(`AUTH_ERROR: ${result.message}`);
          }
          throw new Error("Drizzle Server Action failed: " + result.message);
        }
        return result.data as unknown as Order;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("AUTH_ERROR")) {
          throw error;
        }
        console.error("Drizzle ordersRepository.create error:", error);
        throw error;
      }
    }

    // --- Mock Fallback ---
    const all = await this.getAll();
    const orderNumber = `A-${202600 + all.length}`;
    
    const cleanOrderNum = String(202600 + all.length);
    const mappedParts = (data.parts || []).map((part: Record<string, unknown>, index: number) => {
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
        const customer = customers.find((c: { id: string, name: string }) => c.id === data.customerId);
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
      dueLabel: "Fällig in",
      dueValue: "10 Tagen",
      parts: mappedParts
    };

    const updated = [newOrder, ...all];

    if (OfflineManager.isOffline()) {
      console.log("📴 Offline: Queuing order creation in IndexedDB");
      await OfflineManager.enqueueAction("ORDER_CREATE", data);
      
      if (typeof window !== "undefined") {
        localStorage.setItem("kreile_orders", JSON.stringify(updated));
      }
      return newOrder;
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
    if (isSupabase) {
      try {
        const result = await updateOrderDb(idOrNumber, changes);
        if (!result.ok) {
          if (result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN") {
            throw new Error(`AUTH_ERROR: ${result.message}`);
          }
          throw new Error("Update failed: " + result.message);
        }
        
        // Return the updated object by re-fetching all and finding it,
        // ensuring we have the exact UI format mapped correctly.
        const all = await this.getAll();
        const updatedOrder = all.find(o => o.id === idOrNumber || o.orderNumber === idOrNumber);
        return updatedOrder || null;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("AUTH_ERROR")) {
          throw error;
        }
        console.error("Drizzle ordersRepository.updateOrder error:", error);
        throw error;
      }
    }

    // --- Mock Fallback ---
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
