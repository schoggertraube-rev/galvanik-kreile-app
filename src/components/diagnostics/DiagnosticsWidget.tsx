import { createFoundationUnavailableComponent } from "@/components/foundation/createFoundationUnavailableComponent";

export const DiagnosticsWidget = createFoundationUnavailableComponent({
  title: "Diagnose nicht freigegeben",
  reason: "Entwicklerdiagnosen benötigen einen separaten Telemetrie- und Auditvertrag.",
});
