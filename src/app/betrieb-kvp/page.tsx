import "./BetriebKvpClient";
import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export const metadata = {
  title: "Betriebs-KVP | Kreile App",
  description: "Betrieblicher Verbesserungsprozess",
};

export default function BetriebKvpPage() {
  return <FoundationUnavailable title="Betriebs-KVP nicht freigegeben" reason="Die bisherige KVP-Funktion nutzt einen nicht tenant-gesicherten Client-Schreibpfad und kann Umsetzungen nur vortäuschen. Bis zum kanonischen Serververtrag ist sie gesperrt." returnHref="/" returnLabel="Zur Startseite" />;
}
