import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export const dynamic = "force-dynamic";

export default function AnalysePage() {
  return (
    <FoundationUnavailable
      title="Analyse ist noch nicht freigegeben"
      reason="Die Analyseoberfläche wird erst wieder aktiviert, wenn jede Aussage bis zu ihren Quellen, ihrer Berechnung und ihrem Datenabdeckungszustand zurückverfolgt werden kann."
    />
  );
}
