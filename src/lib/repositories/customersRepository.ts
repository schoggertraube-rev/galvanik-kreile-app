import { createId } from "@paralleldrive/cuid2";
import { EXTENDED_CUSTOMERS as INITIAL_CUSTOMERS } from "@/lib/mockCustomersExtended";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { IndexedDBHelper } from "@/lib/offline/IndexedDBHelper";
import { Customer } from "@/lib/types/customer";
import { createClient } from "@/lib/supabase/client";

export type { Customer };

const isSupabase = process.env.NEXT_PUBLIC_DATA_PROVIDER === 'supabase';

export const customersRepository = {
  async getAll(): Promise<Customer[]> {
    if (isSupabase) {
      const supabase = createClient();
      const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error("Supabase customersRepository.getAll error:", error);
        throw error;
      }
      
      return data.map(c => ({
        id: c.id,
        customerNumber: c.id.substring(0, 8), // Fallback since DB has no customer_number column
        name: c.name,
        type: c.type,
        contactPerson: c.contact_person,
        email: c.email,
        phone: c.phone,
        paymentProfile: c.payment_profile || undefined,
        approvalProfile: c.approval_profile || undefined,
        expectationProfile: c.expectation_profile || undefined,
        technicalProfile: c.technical_profile || undefined,
        trustLevel: c.trust_level || undefined,
        internalWarning: c.internal_warning || undefined,
        tags: c.tags || [],
        creditRating: c.credit_rating || undefined,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      })) as Customer[];
    }

    // --- Mock Fallback ---
    if (typeof window !== "undefined") {
      if (OfflineManager.isOffline()) {
        const cached = await IndexedDBHelper.getSnapshot<Customer>("customers");
        if (cached && cached.length > 0) {
          console.log("📴 Loaded customers from IndexedDB cache (Offline Mode)");
          return cached;
        }
      }

      const saved = localStorage.getItem("kreile_customers");
      const customers = saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
      
      if (!saved) {
        localStorage.setItem("kreile_customers", JSON.stringify(INITIAL_CUSTOMERS));
      }

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
    if (isSupabase) {
      const supabase = createClient();
      const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
      if (error) {
        // PostgREST returns a PGROUTINE error if 0 rows, so we handle it gracefully or log it
        if (error.code === 'PGRST116') return null; // No rows found
        console.error("Supabase customersRepository.getById error:", error);
        throw error;
      }
      if (!data) return null;

      return {
        id: data.id,
        customerNumber: data.id.substring(0, 8),
        name: data.name,
        type: data.type,
        contactPerson: data.contact_person,
        email: data.email,
        phone: data.phone,
        paymentProfile: data.payment_profile || undefined,
        approvalProfile: data.approval_profile || undefined,
        expectationProfile: data.expectation_profile || undefined,
        technicalProfile: data.technical_profile || undefined,
        trustLevel: data.trust_level || undefined,
        internalWarning: data.internal_warning || undefined,
        tags: data.tags || [],
        creditRating: data.credit_rating || undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      } as Customer;
    }

    // --- Mock Fallback ---
    const all = await this.getAll();
    return all.find(c => c.id === id) || null;
  },

  async create(data: Omit<Customer, "id" | "customerNumber">): Promise<Customer> {
    if (isSupabase) {
      const supabase = createClient();
      const newId = createId();
      
      const newCustomerDb = {
        id: newId,
        name: data.name,
        type: data.type,
        contact_person: data.contactPerson,
        email: data.email,
        phone: data.phone,
        payment_profile: data.paymentProfile || null,
        approval_profile: data.approvalProfile || null,
        expectation_profile: data.expectationProfile || null,
        technical_profile: data.technicalProfile || null,
        trust_level: data.trustLevel || null,
        internal_warning: data.internalWarning || null,
        tags: data.tags || null,
        credit_rating: data.creditRating || null
      };

      const { error } = await supabase.from('customers').insert(newCustomerDb);
      if (error) {
        console.error("Supabase customersRepository.create error:", error);
        throw error;
      }
      
      return {
        ...data,
        id: newId,
        customerNumber: newId.substring(0, 8)
      } as Customer;
    }

    // --- Mock Fallback ---
    const all = await this.getAll();
    const newCustomer: Customer = {
      ...data,
      id: createId(),
      customerNumber: `K-${1000 + all.length}`
    };
    
    const updated = [...all, newCustomer];

    if (OfflineManager.isOffline()) {
      console.log("📴 Offline: Queuing customer creation in IndexedDB");
      await OfflineManager.enqueueAction("CUSTOMER_CREATE", data);
      
      if (typeof window !== "undefined") {
        localStorage.setItem("kreile_customers", JSON.stringify(updated));
      }
      return newCustomer;
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
    if (isSupabase) {
      const supabase = createClient();
      
      const updateData: any = {};
      if (changes.name !== undefined) updateData.name = changes.name;
      if (changes.type !== undefined) updateData.type = changes.type;
      if (changes.contactPerson !== undefined) updateData.contact_person = changes.contactPerson;
      if (changes.email !== undefined) updateData.email = changes.email;
      if (changes.phone !== undefined) updateData.phone = changes.phone;
      if (changes.paymentProfile !== undefined) updateData.payment_profile = changes.paymentProfile;
      if (changes.approvalProfile !== undefined) updateData.approval_profile = changes.approvalProfile;
      if (changes.expectationProfile !== undefined) updateData.expectation_profile = changes.expectationProfile;
      if (changes.technicalProfile !== undefined) updateData.technical_profile = changes.technicalProfile;
      if (changes.trustLevel !== undefined) updateData.trust_level = changes.trustLevel;
      if (changes.internalWarning !== undefined) updateData.internal_warning = changes.internalWarning;
      if (changes.tags !== undefined) updateData.tags = changes.tags;
      if (changes.creditRating !== undefined) updateData.credit_rating = changes.creditRating;

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase.from('customers').update(updateData).eq('id', id);
        if (error) {
          console.error("Supabase customersRepository.updateCustomer error:", error);
          throw error;
        }
      }
      
      return this.getById(id);
    }

    // --- Mock Fallback ---
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

    if (OfflineManager.isOffline()) {
      console.log("📴 Offline: Queuing customer update in IndexedDB");
      await OfflineManager.enqueueAction("CUSTOMER_UPDATE", { id, changes });
      
      if (typeof window !== "undefined") {
        localStorage.setItem("kreile_customers", JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));
      }
      return updatedCustomer;
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
