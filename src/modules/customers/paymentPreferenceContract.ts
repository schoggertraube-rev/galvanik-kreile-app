export const CUSTOMER_PAYMENT_PREFERENCES = [
  { value: "vorkasse", label: "Vorkasse", requiresInvoiceTerms: false },
  { value: "bar", label: "Bar oder Karte bei Abholung", requiresInvoiceTerms: false },
  { value: "rechnung", label: "Rechnung auf Ziel", requiresInvoiceTerms: true },
] as const;

export type CustomerPaymentPreference = typeof CUSTOMER_PAYMENT_PREFERENCES[number]["value"];

export function isCustomerPaymentPreference(
  value: unknown,
  invoiceTermsEnabled: boolean,
): value is CustomerPaymentPreference {
  return CUSTOMER_PAYMENT_PREFERENCES.some((option) => (
    option.value === value && (!option.requiresInvoiceTerms || invoiceTermsEnabled)
  ));
}
export function customerPaymentLabel(value:string|null|undefined,terms?:{invoiceTermDays?:number|null;cashDiscountPercent?:number|null;cashDiscountDays?:number|null}) {
  if(!value)return "fehlt";
  const option=CUSTOMER_PAYMENT_PREFERENCES.find(entry=>entry.value===value);
  if(!option)return "Zahlungsbedingung ungültig";
  if(value!=="rechnung")return option.label;
  if(!terms?.invoiceTermDays)return "Rechnung auf Ziel · Tage fehlen";
  return `${option.label} · ${terms.invoiceTermDays} Tage${terms.cashDiscountPercent&&terms.cashDiscountPercent>0?` · ${terms.cashDiscountPercent} % Skonto bis ${terms.cashDiscountDays??"fehlt"} Tage`:""}`;
}
