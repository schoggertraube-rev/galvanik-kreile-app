import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export const dynamic = "force-dynamic";

export default function BelegePage() {
  return <FoundationUnavailable title="Belege nicht freigegeben" reason="Belegdaten werden erst nach einem durchgaengigen Finanz-, Rollen- und Mandantenvertrag gezeigt." />;
}
