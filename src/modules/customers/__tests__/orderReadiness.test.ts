import { describe, expect, it } from "vitest";
import { getOrderReadiness } from "../orderReadiness";

const complete = {
  name: "Kreile GmbH",
  customerType: "business" as const,
  phone: "+49 711 5550303",
  contactPerson: "Sabrina Schmidt",
  email: "sabrina@example.invalid",
  street: "Bundesgasse 3",
  zipCode: "70176",
  city: "Stuttgart",
  country: "Deutschland",
  paymentPreference: "vorkasse",
};

describe("getOrderReadiness", () => {
  it("accepts a complete existing customer", () => {
    expect(getOrderReadiness(complete, { requirePaymentPreference: true })).toEqual({ ready: true, issues: [] });
  });

  it("names a country/postcode mismatch concretely", () => {
    expect(getOrderReadiness({ ...complete, zipCode: "3013", city: "Bern" }).issues).toContainEqual({
      field: "zipCode",
      message: "PLZ 3013 passt nicht zu Deutschland",
    });
  });

  it("only requires payment conditions for the money area", () => {
    expect(getOrderReadiness({ ...complete, paymentPreference: null }).ready).toBe(true);
    expect(getOrderReadiness({ ...complete, paymentPreference: null }, { requirePaymentPreference: true }).issues).toContainEqual({
      field: "paymentPreference",
      message: "Zahlungsbedingung fehlt",
    });
  });

  it("requires a contact person for a company but not for a private customer", () => {
    expect(getOrderReadiness({ ...complete, customerType: "privat", name: "Gregor Laucht", contactPerson: null })).toEqual({
      ready: true,
      issues: [],
    });
    expect(getOrderReadiness({ ...complete, customerType: "business", contactPerson: null }).issues).toContainEqual({
      field: "contactPerson",
      message: "Ansprechpartner fehlt",
    });
  });
});
