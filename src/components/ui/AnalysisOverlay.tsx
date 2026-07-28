import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export interface AnalysisOverlayProps extends Record<string, unknown> {
  title?: string;
}

export function AnalysisOverlay({ title = "Analyse nicht freigegeben" }: AnalysisOverlayProps) {
  return <FoundationUnavailable title={title} reason="Die zugrunde liegenden Kennzahlen und Quellverknüpfungen sind noch nicht vollständig belegt." />;
}
