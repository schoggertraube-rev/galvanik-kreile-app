export const CUSTOMER_PAYMENT_PREFERENCES = [
  { value: "vorkasse", label: "Vorkasse", requiresInvoiceTerms: false },
  { value: "bar", label: "Bar", requiresInvoiceTerms: false },
  { value: "rechnung_14", label: "Rechnung 14 Tage", requiresInvoiceTerms: true },
  { value: "rechnung_30", label: "Rechnung 30 Tage", requiresInvoiceTerms: true },
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
