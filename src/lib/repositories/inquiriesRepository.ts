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
    throw new Error("NOT_AVAILABLE: Sicherer W3-Read-Vertrag fehlt.");
  },

  async getOpenCount(): Promise<number> {
    throw new Error("NOT_AVAILABLE: Sicherer W3-Read-Vertrag fehlt.");
  },

  async create(data: Omit<QuoteRequest, "id" | "receivedAt" | "status" | "pricing">): Promise<QuoteRequest> {
    void data;
    throw new Error("NOT_AVAILABLE: Sicherer W3-Command-Vertrag fehlt.");
  },

  async updateStatus(id: string, status: QuoteRequest["status"]): Promise<QuoteRequest | null> {
    void id;
    void status;
    return null;
  },

  async updatePricing(id: string, pricing: QuoteRequest["pricing"]): Promise<QuoteRequest | null> {
    void id;
    void pricing;
    return null;
  },
};
