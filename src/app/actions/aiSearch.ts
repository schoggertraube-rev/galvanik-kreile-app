"use server";

import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

export type GlobalAiSearchResponse = Record<string, unknown> & {
  zusammenfassung: string;
  kernzahlen: Array<{ label: string; wert: string; trend: string; delta: string }>;
  auffaelligkeiten: string[];
  empfehlungen: string[];
};

export async function askGlobalAiAction(query: string): Promise<GlobalAiSearchResponse> {
  if (!isFoundationAreaEnabled("Globale KI-Suche")) {
    return foundationUnavailableAction("Globale KI-Suche");
  }
  void query;
  return foundationUnavailableAction("Globale KI-Suche");
}
