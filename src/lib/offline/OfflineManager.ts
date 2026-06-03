import { IndexedDBHelper, OfflineAction } from "./IndexedDBHelper";
import type { Order } from "@/lib/repositories/ordersRepository";
import type { StockMovement } from "@/lib/repositories/inventoryRepository";

export const OfflineManager = {
  isOffline(): boolean {
    if (typeof window === "undefined") return false;
    
    // Check if network simulation offline is enabled
    const simulated = localStorage.getItem("kreile_simulated_offline") === "true";
    if (simulated) return true;
    
    // Fallback to real browser network status
    return !navigator.onLine;
  },

  setSimulatedOffline(offline: boolean): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("kreile_simulated_offline", offline ? "true" : "false");
    
    // Dispatch network change event
    window.dispatchEvent(new CustomEvent("kreile-network-change", { 
      detail: { offline: this.isOffline(), simulated: true } 
    }));
    
    // Dispatch storage event to trigger topbar refresh
    window.dispatchEvent(new Event("storage"));
    
    // If we just went online, trigger synchronization
    if (!offline) {
      this.syncQueue().catch(err => console.error("Sync after simulated reconnect failed:", err));
    }
  },

  toggleSimulatedOffline(): void {
    const current = this.isOffline();
    this.setSimulatedOffline(!current);
  },

  async getPendingCount(): Promise<number> {
    try {
      const queue = await IndexedDBHelper.getQueue();
      return queue.length;
    } catch {
      return 0;
    }
  },

  async enqueueAction(actionType: OfflineAction["actionType"], payload: unknown): Promise<OfflineAction> {
    const action = await IndexedDBHelper.pushToQueue(actionType, payload);
    
    // Dispatch queue update event
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("kreile-sync-queue-updated"));
      window.dispatchEvent(new Event("storage")); // force reactive UI repaint
    }
    
    return action;
  },

  async syncQueue(): Promise<void> {
    if (this.isOffline()) {
      console.log("📴 Sync requested, but app is currently offline. Aborting.");
      return;
    }

    const queue = await IndexedDBHelper.getQueue();
    if (queue.length === 0) {
      return;
    }

    console.log(`🔄 Syncing offline queue... Found ${queue.length} actions.`);

    // Dynamic imports of repositories to prevent circular import loops at bundle time
    const { ordersRepository } = await import("@/lib/repositories/ordersRepository");
    const { inventoryRepository } = await import("@/lib/repositories/inventoryRepository");
    const { eventsRepository } = await import("@/lib/repositories/eventsRepository");

    for (const item of queue) {
      try {
        console.log(`Executing synced action: ${item.actionType} (${item.id})`);
        
        switch (item.actionType) {
          case "ORDER_CREATE": {
            await ordersRepository.create(item.payload as Omit<Order, "id" | "orderNumber" | "status" | "risk">);
            break;
          }
          
          case "ORDER_STATUS_UPDATE": {
            const payload = item.payload as { id?: string; orderNumber?: string; changes?: Partial<Order> };
            await ordersRepository.updateOrder(payload.id || payload.orderNumber || "", payload.changes || {});
            break;
          }

          case "CUSTOMER_CREATE": {
            const { customersRepository } = await import("@/lib/repositories/customersRepository");
            await customersRepository.create(item.payload as Omit<import('@/lib/repositories/customersRepository').Customer, "customerNumber" | "prefComm" | "risk">);
            break;
          }
          
          case "CUSTOMER_UPDATE": {
            const { customersRepository } = await import("@/lib/repositories/customersRepository");
            const payload = item.payload as { id: string; changes: Partial<import('@/lib/repositories/customersRepository').Customer> };
            await customersRepository.updateCustomer(payload.id, payload.changes);
            break;
          }
          
          case "MATERIAL_BOOKING": {
            await inventoryRepository.createMovement(item.payload as Omit<StockMovement, "id" | "createdAt">);
            break;
          }
          
          case "TIME_BOOKING": {
            await eventsRepository.addEvent(item.payload as import('../repositories/eventsRepository').StatusEvent);
            break;
          }
          
          case "INQUIRY_CREATE": {
            const { inquiriesRepository } = await import("@/lib/repositories/inquiriesRepository");
            await inquiriesRepository.create(item.payload as Parameters<typeof inquiriesRepository.create>[0]);
            break;
          }
          case "INQUIRY_UPDATE_STATUS": {
            const { inquiriesRepository } = await import("@/lib/repositories/inquiriesRepository");
            const payload = item.payload as { id: string; status: Parameters<typeof inquiriesRepository.updateStatus>[1] };
            await inquiriesRepository.updateStatus(payload.id, payload.status);
            break;
          }
          case "INQUIRY_UPDATE_PRICING": {
            const { inquiriesRepository } = await import("@/lib/repositories/inquiriesRepository");
            const payload = item.payload as { id: string; pricing: Parameters<typeof inquiriesRepository.updatePricing>[1] };
            await inquiriesRepository.updatePricing(payload.id, payload.pricing);
            break;
          }
          case "APP_KVP_CREATE":
          case "BUSINESS_KVP_CREATE": {
            // Mock backend sync for now
            console.log("Mocking backend sync for KVP:", item.payload);
            await new Promise(resolve => setTimeout(resolve, 300));
            break;
          }
        }
        
        // Remove item from queue on success
        await IndexedDBHelper.removeFromQueue(item.id);
        console.log(`Action ${item.id} successfully synced and deleted from queue.`);
        
      } catch (err) {
        console.error(`Failed to sync queued item ${item.id}:`, err);
        // In a live system, we would handle retry limits or mark as error.
        // For our offline-first LWW prototype, we continue to prevent queue blockage.
        await IndexedDBHelper.removeFromQueue(item.id);
      }
    }

    // Dispatch completion events
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("kreile-sync-queue-updated"));
      window.dispatchEvent(new CustomEvent("kreile-sync-success", { detail: { count: queue.length } }));
      window.dispatchEvent(new Event("storage")); // force layout state sync
    }

    console.log("✅ Offline sync queue completed successfully.");
  }
};

// Global browser listeners for automatic synchronization
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("🌐 Browser regained network connection. Starting auto-sync.");
    OfflineManager.syncQueue().catch(err => console.error("Browser auto-sync failed:", err));
  });
}
