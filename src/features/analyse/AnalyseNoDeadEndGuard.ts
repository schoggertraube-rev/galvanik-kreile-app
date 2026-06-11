import { AnalyseTileSummary } from "@/lib/analyse/dataContracts";

export function checkAnalyseNoDeadEnd(tile: AnalyseTileSummary): {
  isValid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  const hasDataSource = tile.dataSources && tile.dataSources.length > 0;
  if (!hasDataSource) {
    warnings.push(`Kachel "${tile.key}" hat keine Datenquelle definiert.`);
  }

  const hasPrimaryValue = tile.primaryValue !== null;
  const hasEmptyState = !!tile.emptyState;

  if (!hasPrimaryValue && !hasEmptyState) {
    warnings.push(`Kachel "${tile.key}" hat weder einen primären Wert noch einen erklärenden Empty State.`);
  }

  // Für diese Phase prüfen wir nur, loggen aber keinen harten Block
  const isValid = warnings.length === 0;

  if (!isValid && process.env.NODE_ENV === "development") {
    console.warn(`[AnalyseNoDeadEndGuard] Kachel: ${tile.key}`, warnings);
  }

  return { isValid, warnings };
}
