import type { CustomerFormValue } from "./customerFormContract";
export type CustomerAddressInput = Pick<CustomerFormValue,"country"|"zipCode"|"city"|"street"|"houseNumber">;
export type CustomerAddressResult = {
  kind: "incomplete" | "found" | "review" | "unavailable" | "not-checked";
  message: string;
  status: "gefunden" | "nicht_pruefbar" | null;
  blocked: boolean;
  suggestions: Array<{ zipCode: string; city: string; street: string | null }>;
};
