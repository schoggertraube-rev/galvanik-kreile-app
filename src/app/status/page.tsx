import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function StatusDelayPage() {
  return (
    <FoundationUnavailable
      title="Betriebsstatus ist noch nicht freigegeben"
      reason="Der bisherige Status nutzte lokale Mock-Aufträge und feste Gegenmaßnahmen. Bis eine belegte, mandantenfähige Datenquelle existiert, werden keine Risiken, Kapazitäten oder Entwarnungen dargestellt."
    />
  );
}
