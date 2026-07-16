import { getPriceAgreementsAction } from "@/app/actions/price-agreements.actions";

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

function unwrap<T>(result: { ok: true; data: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new Error(`DATA_ERROR: ${result.message}`);
  return result.data;
}

export const priceAgreementsRepository = {
  async getAll(): Promise<PriceAgreement[]> {
    return unwrap(await getPriceAgreementsAction());
  },

  async getByCustomer(customerId: string): Promise<PriceAgreement[]> {
    return unwrap(await getPriceAgreementsAction(customerId));
  }
};
