export type OrderReadinessField =
  | "name"
  | "phone"
  | "contactPerson"
  | "email"
  | "street"
  | "zipCode"
  | "city"
  | "country"
  | "paymentPreference";

export type OrderReadinessCustomer = {
  name: string | null | undefined;
  phone: string | null | undefined;
  contactPerson: string | null | undefined;
  email: string | null | undefined;
  street: string | null | undefined;
  zipCode: string | null | undefined;
  city: string | null | undefined;
  country: string | null | undefined;
  paymentPreference: string | null | undefined;
};

export type OrderReadinessIssue = {
  field: OrderReadinessField;
  message: string;
};

export type OrderReadiness = {
  ready: boolean;
  issues: OrderReadinessIssue[];
};

type OrderReadinessOptions = {
  requirePaymentPreference?: boolean;
};

function text(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function validPhone(value: string) {
  return value.length >= 6
    && value.length <= 20
    && /^[0-9 +\-()/]+$/.test(value)
    && value.replace(/\D/g, "").length >= 6;
}

function postcodeIssue(country: string, zipCode: string): string | null {
  if (!zipCode) return "PLZ fehlt";
  if (!country) return null;
  if (country === "Deutschland" && !/^\d{5}$/.test(zipCode)) return `PLZ ${zipCode} passt nicht zu Deutschland`;
  if ((country === "Österreich" || country === "Schweiz") && !/^\d{4}$/.test(zipCode)) return `PLZ ${zipCode} passt nicht zu ${country}`;
  if (country !== "Deutschland" && country !== "Österreich" && country !== "Schweiz" && (zipCode.length < 2 || zipCode.length > 10)) {
    return `PLZ ${zipCode} ist für ${country} ungültig`;
  }
  return null;
}

/** The one pure definition of whether an existing customer can receive an order. */
export function getOrderReadiness(
  customer: OrderReadinessCustomer,
  { requirePaymentPreference = false }: OrderReadinessOptions = {},
): OrderReadiness {
  const issues: OrderReadinessIssue[] = [];
  const name = text(customer.name);
  const phone = text(customer.phone);
  const contactPerson = text(customer.contactPerson);
  const email = text(customer.email);
  const street = text(customer.street);
  const zipCode = text(customer.zipCode);
  const city = text(customer.city);
  const country = text(customer.country);
  const paymentPreference = text(customer.paymentPreference);

  if (name.length < 2) issues.push({ field: "name", message: "Name/Firma fehlt" });
  if (!validPhone(phone)) issues.push({ field: "phone", message: phone ? "Telefon ist ungültig" : "Telefon fehlt" });
  if (!contactPerson) issues.push({ field: "contactPerson", message: "Ansprechpartner fehlt" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push({ field: "email", message: email ? "E-Mail ist ungültig" : "E-Mail fehlt" });
  if (street.length < 2) issues.push({ field: "street", message: "Straße fehlt" });
  if (!country) issues.push({ field: "country", message: "Land fehlt" });
  const postcode = postcodeIssue(country, zipCode);
  if (postcode) issues.push({ field: "zipCode", message: postcode });
  if (!city) issues.push({ field: "city", message: "Ort fehlt" });
  if (requirePaymentPreference && !paymentPreference) issues.push({ field: "paymentPreference", message: "Zahlungsbedingung fehlt" });

  return { ready: issues.length === 0, issues };
}
