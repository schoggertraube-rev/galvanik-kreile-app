import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function PerformanceCockpitPage() {
  return (
    <FoundationUnavailable
      title="Performance-Auswertung ist noch nicht freigegeben"
      reason="Der vorhandene Bildschirm mischt unbelegte Vergleiche, feste Zeitangaben und nicht angebundene Empfehlungen mit echten Auftragsdaten. Er bleibt gesperrt, bis Kennzahlen, Belege und Zustände vollständig aus dem kanonischen Datenvertrag stammen."
    />
  );
}
