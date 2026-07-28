import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export const dynamic = "force-dynamic";

export default function MarketingPage() {
  return (
    <FoundationUnavailable
      title="Marketing ist noch nicht freigegeben"
      reason="Die vorhandene Marketingfläche enthält Vorschläge, Wirkungswerte und Kampagnenzustände ohne vollständig belegten Daten- und Freigabevertrag."
    />
  );
}
