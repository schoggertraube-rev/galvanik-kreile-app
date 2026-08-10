"use server";

import type { ausgangsrechnung } from "@/db/schema";
import type { Order } from "@/lib/repositories/ordersRepository";
import type { PriceAgreement } from "@/lib/repositories/priceAgreementsRepository";
import type { Customer } from "@/lib/types/customer";
import type { InferSelectModel } from "drizzle-orm";

type CustomerQualityCheck = {
  id: string;
  customerId: string;
  orderId: string;
  result: string;
  description: string;
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
};

type CustomerDetails = {
  customer: Customer;
  agreements: PriceAgreement[];
  orders: Order[];
  rechnungen: InferSelectModel<typeof ausgangsrechnung>[];
  complaints: CustomerQualityCheck[];
};

export async function getCustomerDetailsAction(customerIdOrNumber: string): Promise<
  | { ok: true; data: CustomerDetails }
  | { ok: false; error: string; message: string }
> {
  void customerIdOrNumber;
  return {
    ok: false,
    error: "NOT_AVAILABLE",
    message: "NOT_AVAILABLE: Kunden-Detailansicht ben\u00f6tigt einen tenant- und ownership-gepr\u00fcften W3-Read-Vertrag.",
  };
}
