import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function NewQuotePage() {
  return (
    <FoundationUnavailable
      title="Anfrageerfassung nicht freigegeben"
      reason="Für Anfragen besteht noch kein belegter tenant- und preisgesicherter Serververtrag. Es werden keine Anfragen mit Platzhalterpreisen oder Terminen angelegt."
      returnHref="/quotes"
      returnLabel="Zur Übersicht"
    />
  );
}
