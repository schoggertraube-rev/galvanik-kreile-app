import { createClient } from "@/lib/supabase/client";

export type PriceAgreement = {
  id: string;
  customerId: string;
  title: string;
  description?: string;
  surfaceType?: string;
  itemPattern?: string;
  price?: number;
  currency: "EUR";
  validFrom?: string;
  validUntil?: string;
  note?: string;
};

const isSupabase = process.env.NEXT_PUBLIC_DATA_PROVIDER === 'supabase';

function isPriceAgreementsRepositoryEnabled(): boolean {
  return false;
}

export const priceAgreementsRepository = {
  async getAll(): Promise<PriceAgreement[]> {
    if (!isPriceAgreementsRepositoryEnabled()) {
      throw new Error("NOT_CONFIGURED: Preisvereinbarungen benötigen einen geprüften Mandantenvertrag.");
    }
    if (!isSupabase) return [];
    
    const supabase = createClient();
    const { data, error } = await supabase.from('price_agreements').select('*');
    if (error) {
      console.error("Supabase priceAgreementsRepository error:", error);
      return [];
    }
    
    return data.map(r => ({
      id: r.id,
      customerId: r.customer_id,
      title: r.title,
      description: r.description,
      surfaceType: r.surface_type,
      itemPattern: r.item_pattern,
      price: r.price,
      currency: r.currency || "EUR",
      validFrom: r.valid_from,
      validUntil: r.valid_until,
      note: r.note
    }));
  },

  async getByCustomer(customerId: string): Promise<PriceAgreement[]> {
    if (!isPriceAgreementsRepositoryEnabled()) {
      throw new Error("NOT_CONFIGURED: Preisvereinbarungen benötigen einen geprüften Mandantenvertrag.");
    }
    if (!isSupabase) return [];
    
    const supabase = createClient();
    const { data, error } = await supabase.from('price_agreements').select('*').eq('customer_id', customerId);
    if (error) {
      console.error("Supabase priceAgreementsRepository.getByCustomer error:", error);
      return [];
    }
    
    return data.map(r => ({
      id: r.id,
      customerId: r.customer_id,
      title: r.title,
      description: r.description,
      surfaceType: r.surface_type,
      itemPattern: r.item_pattern,
      price: r.price,
      currency: r.currency || "EUR",
      validFrom: r.valid_from,
      validUntil: r.valid_until,
      note: r.note
    }));
  }
};
