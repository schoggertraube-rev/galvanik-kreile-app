"use server";

import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

export type MarketingAnalysisResult = {
  data: unknown;
  error?: unknown;
};

export async function getMarketingAnfragenAnalysisAction(
  von: string,
  bis: string,
): Promise<MarketingAnalysisResult> {
  if (!isFoundationAreaEnabled("Marketinganalyse")) {
    return foundationUnavailableAction("Marketinganalyse");
  }
  void von;
  void bis;
  return foundationUnavailableAction("Marketinganalyse");
}

export async function getMarketingUmsatzAnalysisAction(
  von: string,
  bis: string,
): Promise<MarketingAnalysisResult> {
  if (!isFoundationAreaEnabled("Marketinganalyse")) {
    return foundationUnavailableAction("Marketinganalyse");
  }
  void von;
  void bis;
  return foundationUnavailableAction("Marketinganalyse");
}

export async function getMarketingRoiAnalysisAction(
  von: string,
  bis: string,
): Promise<MarketingAnalysisResult> {
  if (!isFoundationAreaEnabled("Marketinganalyse")) {
    return foundationUnavailableAction("Marketinganalyse");
  }
  void von;
  void bis;
  return foundationUnavailableAction("Marketinganalyse");
}
