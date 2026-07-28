import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function ArchivePage() {
  return (
    <FoundationUnavailable
      title="Archivansicht nicht freigegeben"
      reason="Der bisherige Archivpfad machte Ladefehler zu leeren Beständen. Bis ein kanonischer Abschluss- und Archivvertrag vorliegt, wird kein leerer oder vollständiger Archivbestand behauptet."
      returnHref="/orders"
      returnLabel="Zum Auftragsbuch"
    />
  );
}
