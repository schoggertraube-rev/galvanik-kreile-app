import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function GalvanikPage() {
  return (
    <FoundationUnavailable
      title="Galvanik-Board wird prozesssicher neu angebunden"
      reason="Die frühere Bereit-Liste konnte Aufträge aus dem Wareneingang als Galvanik-Aufträge ausgeben und damit Prozessschritte überspringen. Bis die Vorgänger-Kante serverseitig belegt ist, sind keine Galvanik-Aktionen verfügbar."
      returnHref="/warendurchlauf"
      returnLabel="Zum Warendurchlauf"
    />
  );
}
