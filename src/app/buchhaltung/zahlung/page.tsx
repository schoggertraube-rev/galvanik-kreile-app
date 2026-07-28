import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function ZahlungPage() {
  return <FoundationUnavailable title="Zahlungen nicht freigegeben" reason="Zahlungen, Zahlungsarten und Mahnwerte benoetigen einen geprueften Finanzvertrag." />;
}
