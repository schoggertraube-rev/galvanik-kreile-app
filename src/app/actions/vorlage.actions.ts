"use server";

import { getCaptureOverview } from "./capture.actions";

/** Sichere Kompatibilität für ältere Aufrufer; Identität und Mandant werden serverseitig aufgelöst. */
export async function getVorlageFuerAuftrag(orderId: string) {
  const result = await getCaptureOverview(orderId);
  if (!result.ok) return { hat_vorlage: false as const, error: result.message };
  return result.data.template;
}

/** Liefert nur serverbestätigte, mandantengebundene Lagerartikel. */
export async function getWahrscheinlicheArtikel(orderId: string) {
  const result = await getCaptureOverview(orderId);
  if (!result.ok) throw new Error(result.message);
  return result.data.articles.map((article) => ({
    id: article.id,
    name: article.name,
    einheit: article.unit,
    letzte_menge: article.suggestedQuantity,
    haeufigkeit: article.frequencyPercent,
    bestand: article.currentStock,
    einkaufspreis_eur: article.unitCostEur,
    source: article.source,
  }));
}
