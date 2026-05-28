import { createId } from "@paralleldrive/cuid2";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { IndexedDBHelper } from "@/lib/offline/IndexedDBHelper";
import { MOCK_REQUESTS } from "@/lib/mockData";
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

export const inquiriesRepository = {
  async getAll(): Promise<QuoteRequest[]> {
    if (isSupabase && !OfflineManager.isOffline()) {
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

      if (typeof window !== "undefined") {
        IndexedDBHelper.saveSnapshot("inquiries", mapped.slice(0, 50)).catch(err =>
          console.error("Failed to save inquiries snapshot to IndexedDB:", err)
        );
      }
      return mapped;
    }

    if (typeof window !== "undefined") {
      if (OfflineManager.isOffline()) {
        const cached = await IndexedDBHelper.getSnapshot<QuoteRequest>("inquiries");
        if (cached && cached.length > 0) {
          return cached;
        }
      }
    }
    
    return MOCK_REQUESTS as QuoteRequest[];
  },

  async getOpenCount(): Promise<number> {
    if (isSupabase && !OfflineManager.isOffline()) {
      const supabase = createClient();
      const { count, error } = await supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'offen');
      if (!error && count !== null) return count;
    }
    const all = await this.getAll();
    return all.filter(q => q.status === "offen").length;
  },

  async create(data: Omit<QuoteRequest, "id" | "receivedAt" | "status" | "pricing">): Promise<QuoteRequest> {
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
    
    if (isSupabase && !OfflineManager.isOffline()) {
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
    } else {
      if (typeof window !== "undefined") {
        OfflineManager.enqueueAction("INQUIRY_CREATE", { payload: { ...data, id: newId, status: 'offen', pricing } }).catch(console.error);
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
    if (isSupabase && !OfflineManager.isOffline()) {
      const supabase = createClient();
      const { error } = await supabase.from('inquiries').update({ status }).eq('id', id);
      if (error) {
        console.error("Supabase inquiriesRepository.updateStatus error:", error);
      }
    } else {
      if (typeof window !== "undefined") {
        OfflineManager.enqueueAction("INQUIRY_UPDATE_STATUS", { id, status }).catch(console.error);
      }
    }
    
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event('kreile-inquiries-updated'));
    }
    
    const all = await this.getAll();
    return all.find(q => q.id === id) || null;
  },

  async updatePricing(id: string, pricing: QuoteRequest["pricing"]): Promise<QuoteRequest | null> {
    if (isSupabase && !OfflineManager.isOffline()) {
      const supabase = createClient();
      const { error } = await supabase.from('inquiries').update({ pricing }).eq('id', id);
      if (error) {
        console.error("Supabase inquiriesRepository.updatePricing error:", error);
      }
    } else {
      if (typeof window !== "undefined") {
        OfflineManager.enqueueAction("INQUIRY_UPDATE_PRICING", { id, pricing }).catch(console.error);
      }
    }

    const all = await this.getAll();
    return all.find(q => q.id === id) || null;
  }
};
