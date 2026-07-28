import { createFoundationUnavailableComponent } from "@/components/foundation/createFoundationUnavailableComponent";

export const BaederDashboardClient = createFoundationUnavailableComponent({
  title: "Bäderdaten nicht freigegeben",
  reason: "Messwerte und Maßnahmen haben noch keinen belegten Mandanten-, Messquellen- und Rollenvertrag.",
});
