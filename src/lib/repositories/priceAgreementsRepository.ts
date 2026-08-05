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
