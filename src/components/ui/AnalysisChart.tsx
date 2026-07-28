import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

export interface AnalysisChartProps extends Record<string, unknown> {
  data: unknown[];
  xKey?: string;
  barKey?: string;
  lineKey?: string;
  avgLineKey?: string;
}

export function AnalysisChart(_props: AnalysisChartProps) {
  void _props;
  return <FoundationUnavailable title="Diagramm nicht freigegeben" reason="Die Diagrammdaten besitzen noch keinen geprüften Kennzahlenvertrag." />;
}
