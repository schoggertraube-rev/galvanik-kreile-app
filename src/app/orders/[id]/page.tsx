import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function OrderDetailPage() {
  return (
    <FoundationUnavailable
      title="Auftragsdetail wird neu vertraglich aufgebaut"
      reason="Die frühere Detailansicht enthielt parallele, nicht belegte Daten- und Aktionspfade. Bis der tenant- und receipt-gesicherte Detailvertrag steht, werden hier keine Auftrags-, Rechnungs-, QS-, Foto- oder Versanddaten behauptet."
      returnHref="/orders"
      returnLabel="Zum Auftragsbuch"
    />
  );
}
