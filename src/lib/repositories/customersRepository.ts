import { createId } from "@paralleldrive/cuid2";
import { EXTENDED_CUSTOMERS as INITIAL_CUSTOMERS } from "@/lib/mockCustomersExtended";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { IndexedDBHelper } from "@/lib/offline/IndexedDBHelper";
import { createCustomerDb, getCustomersDb, updateCustomerDb } from "@/app/actions/customers.actions";
import { Customer } from "@/lib/types/customer";

export type { Customer };

export const customersRepository = {
  async getAll(): Promise<Customer[]> {
    if (typeof window !== "undefined") {
      // 1. If online, try fetching from Supabase first
      if (!OfflineManager.isOffline()) {
        try {
          const dbCustomers = await getCustomersDb();
          if (dbCustomers && dbCustomers.length > 0) {
            localStorage.setItem("kreile_customers", JSON.stringify(dbCustomers));
            IndexedDBHelper.saveSnapshot("customers", dbCustomers.slice(0, 100)).catch(err =>
              console.error("Failed to save customers snapshot to IndexedDB:", err)
            );
            return dbCustomers as Customer[];
          }
        } catch (error) {
          console.warn("Failed to fetch customers from Supabase, falling back to cache:", error);
        }
      }

      // 2. If offline or error, try reading from IndexedDB Read-Cache snapshot
      if (OfflineManager.isOffline()) {
        const cached = await IndexedDBHelper.getSnapshot<Customer>("customers");
        if (cached && cached.length > 0) {
          console.log("📴 Loaded customers from IndexedDB cache (Offline Mode)");
          return cached;
        }
      }

      // 3. Fallback to localStorage
      const saved = localStorage.getItem("kreile_customers");
      const customers = saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
      
      if (!saved) {
        localStorage.setItem("kreile_customers", JSON.stringify(INITIAL_CUSTOMERS));
      }

      // 4. If online, update the IndexedDB cache snapshot for next time
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

    // 1. Handle Offline write queue
    if (OfflineManager.isOffline()) {
      console.log("📴 Offline: Queuing customer creation in IndexedDB");
      await OfflineManager.enqueueAction("CUSTOMER_CREATE", data);
      
      if (typeof window !== "undefined") {
        localStorage.setItem("kreile_customers", JSON.stringify(updated));
      }
      return newCustomer;
    }

    // 2. Handle Online standard write to Supabase
    try {
      const dbCustomer = await createCustomerDb({
        id: newCustomer.id,
        name: newCustomer.name,
        type: newCustomer.type,
        city: newCustomer.city,
        email: newCustomer.email,
        phone: newCustomer.phone
      });
      if (dbCustomer) {
        console.log("⚡ Customer created in Supabase:", dbCustomer.customerNumber);
        newCustomer.customerNumber = dbCustomer.customerNumber;
      }
    } catch (error) {
      console.warn("Failed to create customer in Supabase, queuing for sync:", error);
      await OfflineManager.enqueueAction("CUSTOMER_CREATE", data);
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_customers", JSON.stringify(updated));
    }
    return newCustomer;
  },

  async findSimilar(nameOrPhone: string): Promise<Customer[]> {
    const all = await this.getAll();
    if (!nameOrPhone) return [];
    
    const safe = (val: unknown) => String(val ?? "").toLowerCase();
    const search = nameOrPhone.toLowerCase().trim();
    return all.filter(c => 
      safe(c.name).includes(search) || 
      (c.phone && c.phone.includes(search)) ||
      (c.email && safe(c.email).includes(search))
    );
  },

  async updateCustomer(id: string, changes: Partial<Customer>): Promise<Customer | null> {
    const all = await this.getAll();
    let updatedCustomer: Customer | null = null;

    const updated = all.map(c => {
      if (c.id === id) {
        updatedCustomer = { ...c, ...changes };
        return updatedCustomer;
      }
      return c;
    });

    if (!updatedCustomer) return null;

    // 1. Handle Offline write queue
    if (OfflineManager.isOffline()) {
      console.log("📴 Offline: Queuing customer update in IndexedDB");
      await OfflineManager.enqueueAction("CUSTOMER_UPDATE", { id, changes });
      
      if (typeof window !== "undefined") {
        localStorage.setItem("kreile_customers", JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));
      }
      return updatedCustomer;
    }

    // 2. Handle Online standard write to Supabase
    try {
      await updateCustomerDb(id, {
        name: changes.name,
        type: changes.type,
        city: changes.city,
        email: changes.email,
        phone: changes.phone
      });
      console.log("⚡ Customer updated in Supabase:", id);
    } catch (error) {
      console.warn("Failed to update customer in Supabase, queuing for sync:", error);
      await OfflineManager.enqueueAction("CUSTOMER_UPDATE", { id, changes });
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_customers", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
      
      IndexedDBHelper.saveSnapshot("customers", updated.slice(0, 100)).catch(err =>
        console.error("Failed to update customers snapshot:", err)
      );
    }

    return updatedCustomer;
  }
};
