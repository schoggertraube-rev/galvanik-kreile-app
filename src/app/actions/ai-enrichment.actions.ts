"use server";

const denial = "NOT_AVAILABLE: Sicherer W3-KI-/Provider-Vertrag fehlt.";

export async function extractCustomerDataFromFreetext(text: string) {
  void text;
  return { ok: false as const, error: denial };
}

export async function enrichCustomerData(company: string, city: string) {
  void company;
  void city;
  return { ok: false as const, error: denial };
}
