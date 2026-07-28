import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export const dynamic = "force-dynamic";

export default function KontrollePage() {
  return (
    <FoundationUnavailable
      title="Qualitätskontrolle ist noch nicht freigegeben"
      reason="Die benötigte QS-Relation ist im Produkt-Schema nicht vorhanden. Der bisherige Bildschirm hätte leere Daten als fehlende Qualitätsmängel ausgelegt."
    />
  );
}
