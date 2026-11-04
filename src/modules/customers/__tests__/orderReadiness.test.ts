import { describe, expect, it } from "vitest";
import { kundeVollstaendigkeit } from "../orderReadiness";

const complete = {
  companyName: "Kreile GmbH",firstName:"Sabrina",lastName:"Schmidt",houseNumber:"3",
  customerType: "business" as const,
  phone: "+49 711 5550303",
  email: "sabrina@example.invalid",
  street: "Bundesgasse",
  zipCode: "70176",
  city: "Stuttgart",
  country: "DE",
  paymentPreference: "vorkasse",
};

describe("kundeVollstaendigkeit", () => {
  it("accepts a complete existing customer", () => {
    expect(kundeVollstaendigkeit(complete, { geld: true })).toMatchObject({ vollstaendig: true, issues: [] });
  });

  it("names a country/postcode mismatch concretely", () => {
    expect(kundeVollstaendigkeit({ ...complete, zipCode: "3013", city: "Bern" }).issues).toContainEqual({
      field: "zipCode",
      message: "PLZ prüfen",
    });
  });

  it("only requires payment conditions for the money area", () => {
    expect(kundeVollstaendigkeit({ ...complete, paymentPreference: null })).toMatchObject({vollstaendig:false,issues:[],text:"Unvollständig – Zahlungsbedingung fehlt · Büro ergänzt"});
    expect(kundeVollstaendigkeit({ ...complete, paymentPreference: null }, { geld: true }).issues).toContainEqual({
      field: "paymentPreference",
      message: "Zahlungsbedingung fehlt",
    });
  });

  it("requires a contact person for a company but not for a private customer", () => {
    expect(kundeVollstaendigkeit({ ...complete, customerType: "privat", firstName: "Gregor", lastName: "Laucht" })).toMatchObject({
      vollstaendig: true,
      issues: [],
    });
    expect(kundeVollstaendigkeit({ ...complete, customerType: "business", lastName: null }).issues).toContainEqual({
      field: "lastName",
      message: "Ansprechpartner fehlt",
    });
  });
});
