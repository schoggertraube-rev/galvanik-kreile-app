import { createFoundationUnavailableComponent } from "@/components/foundation/createFoundationUnavailableComponent";

export const RechnungForm = createFoundationUnavailableComponent({
  title: "Rechnungserfassung nicht freigegeben",
  reason: "Rechnungen dürfen ohne geprüften Finanz- und Rollenvertrag nicht erzeugt werden.",
});
