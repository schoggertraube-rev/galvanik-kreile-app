import { createId } from "@paralleldrive/cuid2";


import { createClient } from "@/lib/supabase/client";

export type QuoteRequest = {
  id: string;
  customerName: string;
  customerId: string;
  subject: string;
  description: string;
  receivedAt: string;
  rustLevel: "Leicht" | "Mittel" | "Stark" | "Sehr stark";
  dirtLevel: "Sauber" | "Leicht" | "Stark";
  partCount: number;
  material: string;
  status: "offen" | "angeboten" | "archiviert" | "angenommen" | "abgelehnt";
  photo?: string;
  pricing: {
    grundarbeit: number;
    reinigung: number;
    entmetallisierung: number;
    schleifaufwand: number;
    badchemie: number;
    risikopuffer: number;
    marge: number;
  };
};

const isSupabase = process.env.NEXT_PUBLIC_DATA_PROVIDER === 'supabase';

function isInquiriesRepositoryEnabled(): boolean {
  return false;
}

export const inquiriesRepository = {
  async getAll(): Promise<QuoteRequest[]> {
    if (!isInquiriesRepositoryEnabled()) {
      throw new Error("NOT_CONFIGURED: Anfragen benötigen einen geprüften Mandanten- und Receipt-Vertrag.");
    }
    if (isSupabase) {
      const supabase = createClient();
      const { data, error } = await supabase.from('inquiries').select('*').order('created_at', { ascending: false });
      
      if (error) {
        console.error("Supabase inquiriesRepository.getAll error:", error);
        return [];
      }

      const mapped = data.map(db => ({
        id: db.id,
        customerName: db.customer_name,
        customerId: db.customer_id || "",
        subject: db.subject,
        description: db.description,
        receivedAt: db.received_at,
        rustLevel: db.rust_level || "Leicht",
        dirtLevel: db.dirt_level || "Sauber",
        partCount: db.part_count || 1,
        material: db.material || "",
        status: db.status || "offen",
        photo: db.photo,
        pricing: db.pricing || {
          grundarbeit: 0,
          reinigung: 0,
          entmetallisierung: 0,
          schleifaufwand: 0,
          badchemie: 0,
          risikopuffer: 0,
          marge: 0,
        }
      })) as QuoteRequest[];

      return mapped;
    }
    
    return [];
  },

  async getOpenCount(): Promise<number> {
    if (!isInquiriesRepositoryEnabled()) {
      throw new Error("NOT_CONFIGURED: Anfragen benötigen einen geprüften Mandanten- und Receipt-Vertrag.");
    }
    if (isSupabase) {
      const supabase = createClient();
      const { count, error } = await supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'offen');
      if (!error && count !== null) return count;
    }
    const all = await this.getAll();
    return all.filter(q => q.status === "offen").length;
  },

  async create(data: Omit<QuoteRequest, "id" | "receivedAt" | "status" | "pricing">): Promise<QuoteRequest> {
    if (!isInquiriesRepositoryEnabled()) {
      throw new Error("NOT_CONFIGURED: Anfragen benötigen einen geprüften Mandanten- und Receipt-Vertrag.");
    }
    const newId = `inq_${createId()}`;
    const pricing = {
      grundarbeit: 0,
      reinigung: 0,
      entmetallisierung: 0,
      schleifaufwand: 0,
      badchemie: 0,
      risikopuffer: 0,
      marge: 0,
    };
    
    if (isSupabase) {
      const supabase = createClient();
      const dbRow = {
        id: newId,
        tenant_id: 'galvanik-kreile',
        customer_name: data.customerName,
        customer_id: data.customerId || null,
        subject: data.subject,
        description: data.description,
        rust_level: data.rustLevel,
        dirt_level: data.dirtLevel,
        part_count: data.partCount,
        material: data.material,
        status: 'offen',
        pricing: pricing,
      };
      const { error } = await supabase.from('inquiries').insert([dbRow]);
      if (error) {
        console.error("Supabase inquiriesRepository.create error:", error.message, error.details, error.hint);
      }
    }
    
    const newInquiry: QuoteRequest = {
      ...data,
      id: newId,
      receivedAt: new Date().toISOString(),
      status: "offen",
      pricing,
    };
    return newInquiry;
  },

  async updateStatus(id: string, status: QuoteRequest["status"]): Promise<QuoteRequest | null> {
    if (!isInquiriesRepositoryEnabled()) {
      throw new Error("NOT_CONFIGURED: Anfragen benötigen einen geprüften Mandanten- und Receipt-Vertrag.");
    }
    if (isSupabase) {
      const supabase = createClient();
      const { error } = await supabase.from('inquiries').update({ status }).eq('id', id);
      if (error) {
        console.error("Supabase inquiriesRepository.updateStatus error:", error);
      }
    }
    
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event('kreile-inquiries-updated'));
    }
    
    const all = await this.getAll();
    return all.find(q => q.id === id) || null;
  },

  async updatePricing(id: string, pricing: QuoteRequest["pricing"]): Promise<QuoteRequest | null> {
    if (!isInquiriesRepositoryEnabled()) {
      throw new Error("NOT_CONFIGURED: Anfragen benötigen einen geprüften Mandanten- und Receipt-Vertrag.");
    }
    if (isSupabase) {
      const supabase = createClient();
      const { error } = await supabase.from('inquiries').update({ pricing }).eq('id', id);
      if (error) {
        console.error("Supabase inquiriesRepository.updatePricing error:", error);
      }
    }

    const all = await this.getAll();
    return all.find(q => q.id === id) || null;
  }
};
