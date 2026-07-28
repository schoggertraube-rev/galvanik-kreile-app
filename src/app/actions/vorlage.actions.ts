"use server";

import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

export async function getVorlageFuerAuftrag(auftragId: string): Promise<Record<string, unknown>> {
  if (!isFoundationAreaEnabled("Vorlagen")) {
    return foundationUnavailableAction("Vorlagen");
  }
  void auftragId;
  return foundationUnavailableAction("Vorlagen");
}

export async function getWahrscheinlicheArtikel(auftragId: string): Promise<Record<string, unknown>[]> {
  if (!isFoundationAreaEnabled("Vorlagen")) {
    return foundationUnavailableAction("Vorlagen");
  }
  void auftragId;
  return foundationUnavailableAction("Vorlagen");
}
