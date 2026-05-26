import { createId } from "@paralleldrive/cuid2";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { IndexedDBHelper } from "@/lib/offline/IndexedDBHelper";
import { MOCK_REQUESTS } from "@/lib/mockData";

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

export const inquiriesRepository = {
  async getAll(): Promise<QuoteRequest[]> {
    if (typeof window !== "undefined") {
      // Offline-first read approach (similar to orders, but without Supabase actions for now since it's Demo)
      if (OfflineManager.isOffline()) {
        const cached = await IndexedDBHelper.getSnapshot<QuoteRequest>("inquiries");
        if (cached && cached.length > 0) {
          return cached;
        }
      }

      const saved = localStorage.getItem("kreile_inquiries");
      const inquiries = saved ? JSON.parse(saved) : MOCK_REQUESTS;
      
      if (!saved) {
        localStorage.setItem("kreile_inquiries", JSON.stringify(MOCK_REQUESTS));
      }

      if (!OfflineManager.isOffline()) {
        IndexedDBHelper.saveSnapshot("inquiries", inquiries.slice(0, 50)).catch(err =>
          console.error("Failed to save inquiries snapshot to IndexedDB:", err)
        );
      }

      return inquiries as QuoteRequest[];
    }
    return MOCK_REQUESTS as QuoteRequest[];
  },

  async getOpenCount(): Promise<number> {
    const all = await this.getAll();
    return all.filter(q => q.status === "offen").length;
  },

  async create(data: Omit<QuoteRequest, "id" | "receivedAt" | "status" | "pricing">): Promise<QuoteRequest> {
    const newInquiry: QuoteRequest = {
      ...data,
      id: `inq_${createId()}`,
      receivedAt: new Date().toISOString().slice(0, 10),
      status: "offen",
      pricing: {
        grundarbeit: 0,
        reinigung: 0,
        entmetallisierung: 0,
        schleifaufwand: 0,
        badchemie: 0,
        risikopuffer: 0,
        marge: 0,
      }
    };

    const all = await this.getAll();
    const updated = [newInquiry, ...all];
    
    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_inquiries", JSON.stringify(updated));
      OfflineManager.enqueueAction("INQUIRY_CREATE", { payload: newInquiry }).catch(console.error);
    }
    
    return newInquiry;
  },

  async updateStatus(id: string, status: QuoteRequest["status"]): Promise<QuoteRequest | null> {
    const all = await this.getAll();
    const index = all.findIndex(q => q.id === id);
    if (index === -1) return null;

    all[index] = { ...all[index], status };
    
    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_inquiries", JSON.stringify(all));
      OfflineManager.enqueueAction("INQUIRY_UPDATE_STATUS", { id, status }).catch(console.error);
      window.dispatchEvent(new Event('kreile-inquiries-updated'));
    }

    return all[index];
  },

  async updatePricing(id: string, pricing: QuoteRequest["pricing"]): Promise<QuoteRequest | null> {
    const all = await this.getAll();
    const index = all.findIndex(q => q.id === id);
    if (index === -1) return null;

    all[index] = { ...all[index], pricing };
    
    if (typeof window !== "undefined") {
      localStorage.setItem("kreile_inquiries", JSON.stringify(all));
      OfflineManager.enqueueAction("INQUIRY_UPDATE_PRICING", { id, pricing }).catch(console.error);
    }

    return all[index];
  }
};
