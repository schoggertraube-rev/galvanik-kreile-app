import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function LieferantenDetailPage() {
  return (
    <FoundationUnavailable
      title="Lieferantendetails sind noch nicht freigegeben"
      reason="Die frühere Detailseite behauptete Beleg- und Lagerbeziehungen ohne geprüfte Lieferanten-Datenquelle. Deshalb wird kein leerer oder erfundener Lieferantenbestand dargestellt."
      returnHref="/lieferanten"
      returnLabel="Zum Lieferantenbereich"
    />
  );
}
