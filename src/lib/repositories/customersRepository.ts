import { createId } from "@paralleldrive/cuid2";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { Customer } from "@/lib/types/customer";
import { createClient } from "@/lib/supabase/client";

export type { Customer };

function sanitizeCustomerPayload(data: Record<string, any>, isUpdate = false): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;

    if (['approval_profile', 'payment_profile', 'expectation_profile', 'technical_profile'].includes(key)) {
      result[key] = value ?? {};
    } else if (key === 'tags') {
      result[key] = value ?? [];
    } else if (key === 'image_urls') {
      result[key] = value ?? [];
    } else {
      if (!isUpdate && value === null) {
        continue;
      }
      result[key] = value;
    }
  }

  return result;
}

export const customersRepository = {
  async getAll(): Promise<Customer[]> {
    const supabase = createClient();
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error("Supabase customersRepository.getAll error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }

    return data.map(c => ({
      id: c.id,
      customerNumber: c.customer_number || c.id.substring(0, 8),
      name: c.name,
      companyName: c.company_name || undefined,
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
      imageUrls: c.image_urls || [],
      address: c.address || undefined,
      city: c.city || undefined,
      zipCode: c.zip_code || undefined,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    })) as Customer[];
  },

  async getById(id: string): Promise<Customer | null> {
    const supabase = createClient();
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error("Supabase customersRepository.getById error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }
    if (!data) return null;

    return {
      id: data.id,
      customerNumber: data.customer_number || data.id.substring(0, 8),
      name: data.name,
      companyName: data.company_name || undefined,
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
      imageUrls: data.image_urls || [],
      address: data.address || undefined,
      city: data.city || undefined,
      zipCode: data.zip_code || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    } as Customer;
  },

  async create(data: Omit<Customer, "id" | "customerNumber">): Promise<Customer> {
    if (OfflineManager.isOffline()) {
      console.log("📴 Offline: Queuing customer creation");
      await OfflineManager.enqueueAction("CUSTOMER_CREATE", data);
      throw new Error("Device is offline. Customer creation queued.");
    }

    const supabase = createClient();
    const newId = createId();

    const rawCustomerDb = {
      id: newId,
      customer_number: `K-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      name: data.name,
      company_name: data.companyName || null,
      type: data.type,
      address: data.address || null,
      city: data.city || null,
      zip_code: data.zipCode || null,
      image_urls: data.imageUrls || [],
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
      credit_rating: data.creditRating || null,
      notes: data.notes || null
    };

    const newCustomerDb = sanitizeCustomerPayload(rawCustomerDb, false);

    const { error } = await supabase.from('customers').insert(newCustomerDb);
    if (error) {
      console.error("Supabase customersRepository.create error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }

    return {
      ...data,
      id: newId,
      customerNumber: newCustomerDb.customer_number
    } as Customer;
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
    if (OfflineManager.isOffline()) {
      console.log("📴 Offline: Queuing customer update");
      await OfflineManager.enqueueAction("CUSTOMER_UPDATE", { id, changes });
      throw new Error("Device is offline. Customer update queued.");
    }

    const supabase = createClient();

    const rawUpdateData: Record<string, any> = {};
    if (changes.name !== undefined) rawUpdateData.name = changes.name;
    if (changes.companyName !== undefined) rawUpdateData.company_name = changes.companyName;
    if (changes.type !== undefined) rawUpdateData.type = changes.type;
    if (changes.address !== undefined) rawUpdateData.address = changes.address;
    if (changes.city !== undefined) rawUpdateData.city = changes.city;
    if (changes.zipCode !== undefined) rawUpdateData.zip_code = changes.zipCode;
    if (changes.imageUrls !== undefined) rawUpdateData.image_urls = changes.imageUrls;
    if (changes.contactPerson !== undefined) rawUpdateData.contact_person = changes.contactPerson;
    if (changes.email !== undefined) rawUpdateData.email = changes.email;
    if (changes.phone !== undefined) rawUpdateData.phone = changes.phone;
    if (changes.paymentProfile !== undefined) rawUpdateData.payment_profile = changes.paymentProfile;
    if (changes.approvalProfile !== undefined) rawUpdateData.approval_profile = changes.approvalProfile;
    if (changes.expectationProfile !== undefined) rawUpdateData.expectationProfile = changes.expectationProfile;
    if (changes.technicalProfile !== undefined) rawUpdateData.technical_profile = changes.technicalProfile;
    if (changes.trustLevel !== undefined) rawUpdateData.trust_level = changes.trustLevel;
    if (changes.internalWarning !== undefined) rawUpdateData.internal_warning = changes.internalWarning;
    if (changes.tags !== undefined) rawUpdateData.tags = changes.tags;
    if (changes.creditRating !== undefined) rawUpdateData.credit_rating = changes.creditRating;

    const updateData = sanitizeCustomerPayload(rawUpdateData, true);

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase.from('customers').update(updateData).eq('id', id);
      if (error) {
        console.error("Supabase customersRepository.updateCustomer error:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
    }

    return this.getById(id);
  }
};
