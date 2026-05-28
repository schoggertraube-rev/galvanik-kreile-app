// src/lib/customerType/consequences.ts
// Konsequenzen eines Kundentyps ableiten
import type { CustomerType } from "@/types/customerType";
import { CUSTOMER_TYPE_REGISTRY } from "./registry";

export type CustomerConsequences = {
  paymentTermDays: number;
  taxBehavior: "b2c" | "b2b" | "b2b_reverse_charge";
  requiresXRechnung: boolean;
  defaultDiscountPercent: number;
  requiresExtendedDocumentation: boolean;
  message: string;
};

export function getCustomerConsequences(type: CustomerType): CustomerConsequences {
  const config = CUSTOMER_TYPE_REGISTRY[type];
  return {
    paymentTermDays: config.paymentTermDays,
    taxBehavior: config.taxBehavior,
    requiresXRechnung: config.requiresXRechnung,
    defaultDiscountPercent: config.defaultDiscountPercent,
    requiresExtendedDocumentation: config.requiresExtendedDocumentation,
    message: buildConsequenceMessage(config.taxBehavior, config.requiresXRechnung, config.paymentTermDays, config.defaultDiscountPercent),
  };
}

function buildConsequenceMessage(
  taxBehavior: string,
  requiresXRechnung: boolean,
  paymentTermDays: number,
  discount: number
): string {
  const taxLabel = taxBehavior === "b2b" ? "B2B" : "B2C";
  const xr = requiresXRechnung ? ", XRechnung-Vorbereitung" : "";
  const disc = discount > 0 ? `, ${discount} % Stammkundenrabatt` : "";
  return `Rechnung als ${taxLabel}${xr}${disc}, Zahlungsziel ${paymentTermDays} Tage.`;
}
