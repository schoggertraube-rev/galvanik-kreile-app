import {
  createInquiry,
  getInquiries,
  getOpenInquiriesCount,
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

function unwrap<T>(result: { ok: true; data: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(`DATA_ERROR: ${result.message}`);
  return result.data;
}

export const inquiriesRepository = {
  async getAll(): Promise<QuoteRequest[]> {
    return unwrap(await getInquiries());
  },

  async getOpenCount(): Promise<number> {
    return unwrap(await getOpenInquiriesCount());
  },

  async create(data: Omit<QuoteRequest, "id" | "receivedAt" | "status" | "pricing">): Promise<QuoteRequest> {
    return unwrap(await createInquiry(data));
  },

  async updateStatus(id: string, status: QuoteRequest["status"]): Promise<QuoteRequest | null> {
    const updated = unwrap(await updateInquiry(id, { status }));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event('kreile-inquiries-updated'));
    }
    return updated;
  },

  async updatePricing(id: string, pricing: QuoteRequest["pricing"]): Promise<QuoteRequest | null> {
    return unwrap(await updateInquiry(id, { pricing }));
  }
};
