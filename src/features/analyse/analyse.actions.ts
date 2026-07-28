"use server";

import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";
import type {
  AnalyseEntityLink,
  AnalyseTileDetail,
  AnalyseTileKey,
  AnalyseTileSummary,
} from "@/lib/analyse/dataContracts";

type AnalyseActionResult<T> = {
  data: T;
  error?: string;
};

/**
 * Analysis screens were previously assembled from unverified views, fallback
 * values and inferred thresholds. The public action signatures remain for
 * import compatibility, while every path is explicitly unavailable.
 */
export async function getAnalyseOverview(
  period: string,
  filters?: unknown,
): Promise<AnalyseActionResult<AnalyseTileSummary[]>> {
  if (!isFoundationAreaEnabled("Analyse")) {
    return foundationUnavailableAction("Analyse");
  }
  void period;
  void filters;
  return foundationUnavailableAction("Analyse");
}

export async function getAnalyseTileDetail(
  tileKey: AnalyseTileKey,
  period: string,
  filters?: unknown,
): Promise<AnalyseActionResult<AnalyseTileDetail | null>> {
  if (!isFoundationAreaEnabled("Analyse")) {
    return foundationUnavailableAction("Analyse");
  }
  void tileKey;
  void period;
  void filters;
  return foundationUnavailableAction("Analyse");
}

export async function getAnalyseLinkedEntities(
  tileKey: AnalyseTileKey,
  filters?: unknown,
): Promise<AnalyseActionResult<AnalyseEntityLink[]>> {
  if (!isFoundationAreaEnabled("Analyse")) {
    return foundationUnavailableAction("Analyse");
  }
  void tileKey;
  void filters;
  return foundationUnavailableAction("Analyse");
}
