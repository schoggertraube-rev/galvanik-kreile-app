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

const INITIAL_AGREEMENTS: PriceAgreement[] = [
  {
    id: "price-1",
    customerId: "cust-1", // Museum Lenzburg
    title: "Pauschalpreis Jugendstil",
    surfaceType: "Brünieren",
    price: 150,
    currency: "EUR",
    validFrom: "2026-01-01T00:00:00Z",
    note: "Rabatt für öffentliche Einrichtungen",
  }
];

export const priceAgreementsRepository = {
  async getAll(): Promise<PriceAgreement[]> {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kreile_price_agreements");
      if (saved) return JSON.parse(saved);
      localStorage.setItem("kreile_price_agreements", JSON.stringify(INITIAL_AGREEMENTS));
    }
    return INITIAL_AGREEMENTS;
  },

  async getByCustomer(customerId: string): Promise<PriceAgreement[]> {
    const all = await this.getAll();
    return all.filter(p => p.customerId === customerId);
  }
};
