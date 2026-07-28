import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function LieferantenPage() {
  return (
    <FoundationUnavailable
      title="Lieferantenverzeichnis ist noch nicht freigegeben"
      reason="Die frühere Seite behauptete fehlende Stammdaten und verlinkte in nicht freigegebene Finanzbereiche. Bis Lieferanten, Belege und Mandantenzuordnung gemeinsam nachweisbar sind, wird kein Bestand behauptet."
    />
  );
}
