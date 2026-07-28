import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default function CustomerProfilePage() {
  return (
    <FoundationUnavailable
      title="Kundenakte wird neu vertraglich aufgebaut"
      reason="Die frühere Akte verband Aufträge, Preise, Belege, Fotos und Kommunikation über parallele Datenpfade. Bis die gemeinsame tenant- und receipt-gesicherte Detailansicht steht, werden diese Informationen nicht scheinbar vollständig dargestellt."
      returnHref="/customers"
      returnLabel="Zur Kundenkartei"
    />
  );
}
