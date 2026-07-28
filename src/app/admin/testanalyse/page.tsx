import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function TestanalyseDashboard() {
  return (
    <FoundationUnavailable
      title="Testanalyse ist noch nicht freigegeben"
      reason="Die bisherige Testanalyse speichert nur lokal im Browser und ist keine mandantenfähige Entwickler-Telemetrie mit belastbaren Receipts."
    />
  );
}
