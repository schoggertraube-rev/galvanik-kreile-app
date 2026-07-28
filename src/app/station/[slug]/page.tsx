import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

/** The second station workflow remains unavailable until it is merged into the canonical process contract. */
export default function StationPage() {
  return (
    <FoundationUnavailable
      title="Legacy-Stationen sind nicht freigegeben"
      reason="Diese Ansicht enthielt einen zweiten, nicht vollständig tenant- und prozessgesicherten Arbeitsweg. Nutze bis zur belegten Vereinheitlichung den kanonischen Warendurchlauf."
      returnHref="/warendurchlauf"
      returnLabel="Zum Warendurchlauf"
    />
  );
}
