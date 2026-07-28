import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export const dynamic = "force-dynamic";

export default function BetriebPage() {
  return (
    <FoundationUnavailable
      title="Betriebscockpit ist noch nicht freigegeben"
      reason="Die bisherige Navigation verknüpfte unverbundene oder gesperrte Fachbereiche und konnte damit funktionsfähige Betriebsabläufe vortäuschen."
    />
  );
}
