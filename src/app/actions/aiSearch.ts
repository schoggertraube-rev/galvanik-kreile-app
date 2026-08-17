"use server";

export type GlobalAiMetric = { label: string; wert: string; trend: string; delta: string };
export type GlobalAiResponse = { zusammenfassung: string; kernzahlen: GlobalAiMetric[]; auffaelligkeiten: string[]; empfehlungen: string[] };

export async function askGlobalAiAction(query: string): Promise<GlobalAiResponse> {
  void query;
  return { zusammenfassung: "NOT_AVAILABLE: Sicherer W3-KI-/Provider-Vertrag fehlt.", kernzahlen: [], auffaelligkeiten: [], empfehlungen: [] };
}
