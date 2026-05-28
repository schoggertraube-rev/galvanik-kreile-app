// src/types/customerType.ts
// Kundentypen und ihre fachlichen Konsequenzen

export type CustomerType =
  | "private"
  | "business"
  | "oldtimer_fan"
  | "art_furniture"
  | "regular";

export type CustomerTypeConfig = {
  type: CustomerType;
  label: string;
  taxBehavior: "b2c" | "b2b" | "b2b_reverse_charge";
  requiresXRechnung: boolean;
  defaultDiscountPercent: number;
  allowsCustomQuoting: boolean;
  defaultCommunicationChannel: "email" | "phone" | "letter";
  requiresExtendedDocumentation: boolean;
  paymentTermDays: number;
  dunningLevelMax: 1 | 2 | 3;
  warnIfOpenAmountAbove?: number;
};
