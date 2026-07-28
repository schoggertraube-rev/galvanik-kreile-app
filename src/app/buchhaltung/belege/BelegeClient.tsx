import { createFoundationUnavailableComponent } from "@/components/foundation/createFoundationUnavailableComponent";

export const BelegeClient = createFoundationUnavailableComponent({
  title: "Belege nicht freigegeben",
  reason: "Belegdaten und Offlinezustände haben noch keinen geprüften Finanzvertrag.",
});
