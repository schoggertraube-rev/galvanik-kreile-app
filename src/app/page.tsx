import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function HomeDashboard() {
  return (
    <FoundationUnavailable
      title="Leitstand wird auf belegte Daten umgestellt"
      reason="Die frühere Startansicht verwandelte Ladefehler in Entwarnungen und enthielt feste Trend- und Aktionsdaten. Bis die kanonischen Kennzahl- und Handlungsverträge stehen, werden keine Werkstattaussagen behauptet."
      returnHref="/orders"
      returnLabel="Zum Auftragsbuch"
    />
  );
}
