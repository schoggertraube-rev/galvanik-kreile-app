import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function WarendurchlaufIndex() {
  return (
    <FoundationUnavailable
      title="Warendurchlauf-Cockpit ist noch nicht freigegeben"
      reason="Die bisherige Übersicht berechnet Termintreue, Durchlaufzeit und Engpässe aus Ersatzregeln. Die echten Stationsansichten werden separat auf einen transaktionalen Prozesswechsel umgestellt."
    />
  );
}
