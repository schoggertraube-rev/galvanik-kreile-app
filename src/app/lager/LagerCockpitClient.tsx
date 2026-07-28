import { createFoundationUnavailableComponent } from "@/components/foundation/createFoundationUnavailableComponent";

export const LagerCockpitClient = createFoundationUnavailableComponent({
  title: "Lagerdaten nicht freigegeben",
  reason: "Bestands-, Chargen- und Verbrauchsdaten besitzen noch keinen belegten Tenant- und Rollenvertrag.",
});
