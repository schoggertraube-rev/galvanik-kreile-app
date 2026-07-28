import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function KundenAuftraegePage() {
  return (
    <FoundationUnavailable
      title="Kunden und Aufträge werden getrennt neu angebunden"
      reason="Der kombinierte Altpfad nutzte zwei widersprüchliche Datenoberflächen. Bis Kunden- und Auftragsverknüpfungen gemeinsam geprüft sind, wird keine scheinbar vollständige Akte dargestellt."
      returnHref="/"
      returnLabel="Zur Startseite"
    />
  );
}
