import { createFoundationUnavailableComponent } from "@/components/foundation/createFoundationUnavailableComponent";

export const WerkstattPulsOverlay = createFoundationUnavailableComponent({
  title: "Werkstattpuls nicht freigegeben",
  reason: "Die Datenbasis enthält keinen belegten historischen Verlauf oder Echtzeitvertrag.",
});
