import { KommunikationClient } from "./KommunikationClient";
import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function KommunikationPage() {
  return <FoundationUnavailable title="Kommunikation nicht freigegeben" reason="Kommunikations- und Folgeaktionen haben noch keinen kanonischen tenant-, actor- und Provider-Receipt-Vertrag. Bis dahin werden weder Versand noch Termin- oder KI-Aktionen behauptet." returnHref="/" returnLabel="Zur Startseite" />;
}
