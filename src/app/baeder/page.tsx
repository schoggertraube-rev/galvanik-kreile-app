import { BaederDashboardClient } from "./BaederDashboardClient";
import { getBaederListAction } from "./actions";
import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export default async function BaederPage() {
  return <FoundationUnavailable title="Bäderdaten nicht freigegeben" reason="Bäder- und Messwerte besitzen noch keinen vollständig tenant- und messquellen-gesicherten Vertrag. Bis zur belegten Anbindung werden keine Zustände oder Maßnahmen angezeigt." returnHref="/" returnLabel="Zur Startseite" />;
  const result = await getBaederListAction();
  const baederData = result.ok ? result.data : [];
  return <BaederDashboardClient baederData={baederData} />;
}
