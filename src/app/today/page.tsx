import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function TodayDashboard() {
  return (
    <FoundationUnavailable
      title="Tagescockpit ist noch nicht freigegeben"
      reason="Die bisherige Ansicht wandelt Ladefehler und fehlende Termine in Nullwerte, Gegenmaßnahmen und Entwarnungen um. Bis ein belegter Tagesstatus-Vertrag vorliegt, bleibt der Bereich bewusst gesperrt."
    />
  );
}
