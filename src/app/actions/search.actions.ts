"use server";

import { foundationUnavailableAction, isFoundationAreaEnabled } from "@/lib/server/foundationGate";

export interface SearchResult {
  id: string;
  type: "customer" | "order" | "item";
  title: string;
  subtitle: string;
  url: string;
}

export async function globalSearch(
  query: string,
): Promise<{ ok: boolean; results?: SearchResult[]; error?: string }> {
  if (!isFoundationAreaEnabled("Globale Suche")) {
    return foundationUnavailableAction("Globale Suche");
  }
  void query;
  return foundationUnavailableAction("Globale Suche");
}
