import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function LagerPage() {
  return (
    <FoundationUnavailable
      title="Lagerbestand ist noch nicht freigegeben"
      reason="Die aktuell erwartete Lagerrelation ist im Produkt-Schema nicht vorhanden. Deshalb wird weder ein Bestand noch eine Material-Entwarnung angezeigt."
    />
  );
}
