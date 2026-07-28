import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function WareneingangPage() {
  return (
    <FoundationUnavailable
      title="Wareneingang ist noch nicht freigegeben"
      reason="Die frühere Leitstandsansicht mischte Ersatzkennzahlen, lokale Erfassung und ungesicherte Statuswechsel. Bis der Beleg- und Prozessvertrag durchgängig geprüft ist, wird kein Auftrags- oder Fortschrittszustand simuliert."
      returnHref="/warendurchlauf"
      returnLabel="Zum Warendurchlauf"
    />
  );
}
