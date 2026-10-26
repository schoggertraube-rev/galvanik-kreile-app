import "server-only";

const API_VERSION = "2024-11-30";
type Environment = Record<string, string | undefined>;
type FetchPort = typeof fetch;

export type DocumentSuggestion = {
  field: "CUSTOMER_NAME" | "CONTACT_PERSON" | "EMAIL" | "PHONE" | "ADDRESS" | "DUE_DATE" | "ITEM_DESCRIPTION" | "QUANTITY" | "MATERIAL" | "SURFACE" | "OTHER";
  label: string;
  value: string;
  confidence: number;
  source: { page: number; polygon: number[] };
};

type AzureResult = { code: "OK"; data: { suggestions: DocumentSuggestion[] } } | { code: "IN_KLAERUNG" | "UNAVAILABLE"; message: string };

export function readAzureDocumentIntelligenceStatus(env: Environment = process.env) {
  return env.AZURE_DOCINTEL_ENDPOINT?.trim() && env.AZURE_DOCINTEL_KEY?.trim()
    ? { code: "READY" as const }
    : { code: "IN_KLAERUNG" as const };
}

function classify(label: string): DocumentSuggestion["field"] {
  const key = label.toLocaleLowerCase("de-DE").replace(/[^a-z0-9äöüß]+/g, " ").trim();
  if (/firma|kunde|kundename|auftraggeber/.test(key)) return "CUSTOMER_NAME";
  if (/ansprechpartner|kontaktperson|kontakt/.test(key)) return "CONTACT_PERSON";
  if (/e mail|email/.test(key)) return "EMAIL";
  if (/telefon|tel |mobil/.test(`${key} `)) return "PHONE";
  if (/anschrift|adresse|straße|strasse/.test(key)) return "ADDRESS";
  if (/liefertermin|termin|fällig|faellig/.test(key)) return "DUE_DATE";
  if (/beschreibung|leistung|artikel|position|bezeichnung/.test(key)) return "ITEM_DESCRIPTION";
  if (/menge|anzahl|stück|stueck/.test(key)) return "QUANTITY";
  if (/material|werkstoff/.test(key)) return "MATERIAL";
  if (/oberfläche|oberflaeche|beschichtung/.test(key)) return "SURFACE";
  return "OTHER";
}

function suggestions(payload: unknown): DocumentSuggestion[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const result = (payload as Record<string, unknown>).analyzeResult;
  if (!result || typeof result !== "object" || Array.isArray(result)) return [];
  const pairs = (result as Record<string, unknown>).keyValuePairs;
  if (!Array.isArray(pairs)) return [];
  const output: DocumentSuggestion[] = [];
  for (const pairValue of pairs) {
    if (!pairValue || typeof pairValue !== "object" || Array.isArray(pairValue)) continue;
    const pair = pairValue as Record<string, unknown>;
    const key = pair.key && typeof pair.key === "object" && !Array.isArray(pair.key) ? pair.key as Record<string, unknown> : {};
    const value = pair.value && typeof pair.value === "object" && !Array.isArray(pair.value) ? pair.value as Record<string, unknown> : {};
    const label = typeof key.content === "string" ? key.content.trim().slice(0, 200) : "";
    const content = typeof value.content === "string" ? value.content.trim().slice(0, 1000) : "";
    const confidence = typeof pair.confidence === "number" ? pair.confidence : typeof value.confidence === "number" ? value.confidence : 0;
    const regions = Array.isArray(value.boundingRegions) ? value.boundingRegions : Array.isArray(key.boundingRegions) ? key.boundingRegions : [];
    const region = regions[0] && typeof regions[0] === "object" && !Array.isArray(regions[0]) ? regions[0] as Record<string, unknown> : {};
    const page = typeof region.pageNumber === "number" && Number.isInteger(region.pageNumber) ? region.pageNumber : 1;
    const polygon = Array.isArray(region.polygon) ? region.polygon.filter((point): point is number => typeof point === "number" && Number.isFinite(point)).slice(0, 16) : [];
    if (!label || !content || confidence < 0 || confidence > 1) continue;
    output.push({ field: classify(label), label, value: content, confidence, source: { page, polygon } });
  }
  return output.slice(0, 80);
}

export async function analyzeWithAzureDocumentIntelligence(
  bytes: Uint8Array,
  mimeType: string,
  env: Environment = process.env,
  fetchPort: FetchPort = fetch,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
): Promise<AzureResult> {
  const endpointValue = env.AZURE_DOCINTEL_ENDPOINT?.trim();
  const key = env.AZURE_DOCINTEL_KEY?.trim();
  if (!endpointValue || !key) return { code: "IN_KLAERUNG", message: "Azure Document Intelligence ist noch nicht für die Preview verbunden." };
  if (bytes.byteLength < 1 || bytes.byteLength > 20 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    return { code: "UNAVAILABLE", message: "Das Dokumentformat kann nicht sicher analysiert werden." };
  }
  try {
    const endpoint = new URL(endpointValue);
    if (endpoint.protocol !== "https:") throw new Error("AZURE_ENDPOINT_INVALID");
    const analyzeUrl = new URL("documentintelligence/documentModels/prebuilt-layout:analyze", endpoint.href.endsWith("/") ? endpoint : `${endpoint.href}/`);
    analyzeUrl.searchParams.set("_overload", "analyzeDocument");
    analyzeUrl.searchParams.set("api-version", API_VERSION);
    analyzeUrl.searchParams.set("features", "keyValuePairs");
    const response = await fetchPort(analyzeUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "Ocp-Apim-Subscription-Key": key },
      body: JSON.stringify({ base64Source: Buffer.from(bytes).toString("base64") }),
      cache: "no-store",
    });
    if (response.status !== 202) throw new Error(`AZURE_ANALYZE_${response.status}`);
    const operationHeader = response.headers.get("operation-location");
    if (!operationHeader) throw new Error("AZURE_OPERATION_MISSING");
    const operation = new URL(operationHeader);
    if (operation.origin !== endpoint.origin || !operation.pathname.includes("/documentintelligence/documentModels/prebuilt-layout/analyzeResults/")) throw new Error("AZURE_OPERATION_INVALID");
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (attempt > 0) await wait(500);
      const poll = await fetchPort(operation, { headers: { "Ocp-Apim-Subscription-Key": key }, cache: "no-store" });
      if (!poll.ok) throw new Error(`AZURE_RESULT_${poll.status}`);
      const payload = await poll.json() as Record<string, unknown>;
      if (payload.status === "succeeded") return { code: "OK", data: { suggestions: suggestions(payload) } };
      if (payload.status === "failed") throw new Error("AZURE_ANALYZE_FAILED");
      if (payload.status !== "running" && payload.status !== "notStarted") throw new Error("AZURE_STATUS_INVALID");
    }
    return { code: "UNAVAILABLE", message: "Die Dokumentanalyse läuft länger als erwartet. Bitte später erneut prüfen." };
  } catch {
    return { code: "UNAVAILABLE", message: "Das Dokument konnte mit Azure nicht sicher analysiert werden." };
  }
}
