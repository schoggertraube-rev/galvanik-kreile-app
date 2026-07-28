import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function AnalyticsPage() {
  return (
    <FoundationUnavailable
      title="Entwickler-Analyse ist noch nicht freigegeben"
      reason="Die bisherige Ansicht ergänzte Nutzungsdaten um feste Reibungswerte, Geräteanteile und Vorschläge. Bis eine authentisierte, mandantenfähige Telemetrie mit nachvollziehbaren Receipts existiert, werden keine Analyseaussagen dargestellt."
    />
  );
}
