import { createFoundationUnavailableComponent } from "@/components/foundation/createFoundationUnavailableComponent";

export const StationContextBlock = createFoundationUnavailableComponent({
  title: "Stationskontext nicht freigegeben",
  reason: "Station, Teilzuweisung und Prozessereignisse benötigen den tenant-konfigurierbaren Prozessvertrag.",
});
