import { EMPTY_CUSTOMER_FORM, customerFieldError, type CustomerFormValue } from "./customerFormContract";

export type OrderReadinessField = keyof CustomerFormValue;
export type OrderReadinessCustomer = Omit<Partial<{ [Key in keyof CustomerFormValue]: CustomerFormValue[Key] | null }>,"paymentTermDays"> & {paymentTermDays?: string | number | null; invoiceTermsEnabled?: boolean | null};
export type OrderReadinessIssue = { field: OrderReadinessField; message: string };
export type OrderReadiness = {
  vollstaendig: boolean; fehlt: string[]; felder: OrderReadinessField[]; text: string;
  issues: OrderReadinessIssue[];
};

/** One customer completeness contract for both client and server. */
export function kundeVollstaendigkeit(customer: OrderReadinessCustomer, { geld = false }: { geld?: boolean } = {}): OrderReadiness {
  const value = { ...EMPTY_CUSTOMER_FORM, customerType: "", country: "", paymentPreference: "" } as CustomerFormValue;
  for (const key of Object.keys(value) as Array<keyof CustomerFormValue>) {
    const incoming = customer[key];
    if (incoming !== undefined && incoming !== null) Object.assign(value, { [key]: incoming });
  }
  const fehlt: string[] = [];
  const issues: OrderReadinessIssue[] = [];
  const missing = (label: string, fields: OrderReadinessField[]) => {
    if (!fields.length) return;
    fehlt.push(label);
    for (const field of fields) issues.push({ field, message: customerFieldError(field, value) ?? `${label} fehlt` });
  };
  const absent = (field: OrderReadinessField) => !String(value[field]).trim() || customerFieldError(field, value) !== null
    || field === "paymentPreference" && value.paymentPreference === "rechnung" && customer.invoiceTermsEnabled !== true;
  if (value.customerType === "lieferant") {
    missing("Name", absent("companyName") ? ["companyName"] : []);
  } else {
    missing("Name", value.customerType === "privat" ? absent("lastName") ? ["lastName"] : [] : absent("companyName") ? ["companyName"] : []);
    if (value.customerType === "business") missing("Ansprechpartner", absent("lastName") ? ["lastName"] : []);
    if (value.customerType === "privat") missing("Vorname", absent("firstName") ? ["firstName"] : []);
    missing("Telefon", absent("phone") ? ["phone"] : []);
    missing("E-Mail", absent("email") ? ["email"] : []);
    missing("Anschrift", (["street", "houseNumber", "zipCode", "city", "country"] as OrderReadinessField[]).filter(absent));
    if (geld) missing("Zahlungsbedingung", absent("paymentPreference") ? ["paymentPreference"] : []);
  }
  const paymentHint = value.customerType !== "lieferant" && !geld && absent("paymentPreference");
  const text = fehlt.length
    ? `Unvollständig – für Auftrag fehlt: ${fehlt.join(", ")}${paymentHint ? " · Zahlungsbedingung fehlt · Büro ergänzt" : ""}`
    : paymentHint ? "Unvollständig – Zahlungsbedingung fehlt · Büro ergänzt" : "Vollständig für Auftrag";
  return { vollstaendig: fehlt.length === 0 && !paymentHint, fehlt, felder: issues.map(issue => issue.field), text, issues };
}
