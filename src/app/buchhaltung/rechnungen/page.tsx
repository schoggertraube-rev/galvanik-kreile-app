import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export const dynamic = "force-dynamic";

export default function RechnungenPage() {
  return <FoundationUnavailable title="Rechnungen nicht freigegeben" reason="Rechnungen und Mahnstatus bleiben bis zum belegten Finanzvertrag gesperrt." />;
}
