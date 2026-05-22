import { createId } from "@paralleldrive/cuid2";
import { INITIAL_CUSTOMERS } from "@/lib/mockData";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { IndexedDBHelper } from "@/lib/offline/IndexedDBHelper";

export type Customer = {
  id: string;
  customerNumber: string;
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  address?: string;
  type?: "Privatkunde" | "Geschäftskunde" | "Institution" | "institution" | "business" | "private";
  prefComm?: "E-Mail" | "Telefon" | "Brief / Post";
  risk?: "Niedrig" | "Mittel" | "Hoch";
  riskNote?: string;
  notes?: string;
}

export const customersRepository = {
  async getAll(): Promise<Customer[]> {
    if (typeof window !== "undefined") {
      // 1. If offline, try reading from IndexedDB Read-Cache snapshot
      if (OfflineManager.isOffline()) {
        const cached = await IndexedDBHelper.getSnapshot<Customer>("customers");
        if (cached && cached.length > 0) {
          console.log("📴 Loaded customers from IndexedDB cache (Offline Mode)");
          return cached;
        }
      }

      // 2. Fallback to localStorage
      const saved = localStorage.getItem("kreile_customers");
      const customers = saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
      
      if (!saved) {
        localStorage.setItem("kreile_customers", JSON.stringify(INITIAL_CUSTOMERS));
      }

      // 3. If online, asynchronously update the IndexedDB cache snapshot for next time
      if (!OfflineManager.isOffline()) {
        IndexedDBHelper.saveSnapshot("customers", customers.slice(0, 100)).catch(err =>
          console.error("Failed to save customers snapshot to IndexedDB:", err)
        );
      }

      return customers as Customer[];
    }
    return INITIAL_CUSTOMERS as unknown as Customer[];
  },

  async getById(id: string): Promise<Customer | null> {
    const all = await this.getAll();
    return all.find(c => c.id === id) || null;
  },

  async create(data: Omit<Customer, "id" | "customerNumber">): Promise<Customer> {
    const all = await this.getAll();
    const newCustomer: Customer = {
      ...data,
      id: createId(),
      customerNumber: `K-${1000 + all.length}`
    };
    
    const updated = [...all, newCustomer];
    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_customers", JSON.stringify(updated));
    }
    return newCustomer;
  },

  async findSimilar(nameOrPhone: string): Promise<Customer[]> {
    const all = await this.getAll();
    if (!nameOrPhone) return [];
    
    const search = nameOrPhone.toLowerCase().trim();
    return all.filter(c => 
      c.name.toLowerCase().includes(search) || 
      (c.phone && c.phone.includes(search)) ||
      (c.email && c.email.toLowerCase().includes(search))
    );
  }
};
