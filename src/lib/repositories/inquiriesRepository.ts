import {
  getInquiries,
  getOpenInquiriesCount,
  createInquiry,
  updateInquiry,
} from "@/app/actions/inquiries.actions";

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

// All data access delegates to the inquiries server action (Drizzle,
// privileged). The browser Supabase client is intentionally NOT used here:
// with the Data-API locked down it cannot read or write, and previously
// masked failures as success, silently losing quote requests.
export const inquiriesRepository = {
  async getAll(): Promise<QuoteRequest[]> {
    return getInquiries();
  },

  async getOpenCount(): Promise<number> {
    return getOpenInquiriesCount();
  },

  async create(data: Omit<QuoteRequest, "id" | "receivedAt" | "status" | "pricing">): Promise<QuoteRequest> {
    const result = await createInquiry(data as Record<string, unknown>);
    if (!result.success) {
      const detail = result.errors
        ? JSON.stringify(result.errors)
        : (result.error ?? "Unbekannter Fehler");
      throw new Error(`Anfrage konnte nicht gespeichert werden: ${detail}`);
    }
    return result.data as QuoteRequest;
  },

  async updateStatus(id: string, status: QuoteRequest["status"]): Promise<QuoteRequest | null> {
    const updated = await updateInquiry(id, { status });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("kreile-inquiries-updated"));
    }
    return updated;
  },

  async updatePricing(id: string, pricing: QuoteRequest["pricing"]): Promise<QuoteRequest | null> {
    return updateInquiry(id, { pricing });
  },
};
