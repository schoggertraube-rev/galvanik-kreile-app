import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function WerkstattPulsPage() {
  return (
    <FoundationUnavailable
      title="Werkstatt-Puls ist noch nicht freigegeben"
      reason="Verlauf, Score, Kapazität und Empfehlungen besitzen noch keinen belegten Daten- und Evidenzvertrag."
    />
  );
}
