import { createFoundationUnavailableComponent } from "@/components/foundation/createFoundationUnavailableComponent";

export const RechnungenClient = createFoundationUnavailableComponent({
  title: "Rechnungen nicht freigegeben",
  reason: "Rechnungsdaten und Zahlungsstände sind ohne Finanzvertrag nicht verfügbar.",
});
