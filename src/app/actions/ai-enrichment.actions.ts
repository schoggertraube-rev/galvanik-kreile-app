"use server";

import { resolveAuthorization } from "@/lib/server/authorization";
import {
  parseCustomerEnrichInput,
  parseCustomerEnrichmentResult,
  parseCustomerFreetextResult,
  parseFreetextInput,
  type CustomerEnrichmentResult,
  type CustomerFreetextResult,
} from "@/lib/server/aiInputs";
import { proxyMeteredAiRequest } from "@/lib/server/aiUsage";

type AiActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function authorizedCustomerWriter() {
  const auth = await resolveAuthorization();
  if (!auth.ok || auth.data.tenantId !== "galvanik-kreile" || !auth.data.permissions.includes("perm_data_customers")) {
    return null;
  }
  return auth.data;
}

async function resultFromResponse<T>(
  response: Response,
  parser: (value: unknown) => T,
): Promise<AiActionResult<T>> {
  if (!response.ok) {
    return {
      ok: false,
      error: response.status === 429
        ? "KI-Nutzungslimit erreicht. Bitte später erneut versuchen."
        : "KI-Dienst ist derzeit nicht verfügbar.",
    };
  }
  try {
    return { ok: true, data: parser(await response.json()) };
  } catch {
    return { ok: false, error: "KI-Antwort hatte kein gültiges Datenformat." };
  }
}

export async function extractCustomerDataFromFreetext(text: string): Promise<AiActionResult<CustomerFreetextResult>> {
  const identity = await authorizedCustomerWriter();
  if (!identity) return { ok: false, error: "Keine Berechtigung für Kundendaten." };

  let payload;
  try {
    payload = parseFreetextInput({ text });
  } catch {
    return { ok: false, error: "Freitext fehlt oder ist zu lang." };
  }
  const response = await proxyMeteredAiRequest({
    request: new Request("https://kreile.invalid/internal/customer-freetext", { method: "POST" }),
    identity,
    feature: "freetext-extract",
    payload,
    maxOutputTokens: 1_024,
    parseResult: parseCustomerFreetextResult,
  });
  return resultFromResponse(response, parseCustomerFreetextResult);
}

export async function enrichCustomerData(company: string, city: string): Promise<AiActionResult<CustomerEnrichmentResult>> {
  const identity = await authorizedCustomerWriter();
  if (!identity) return { ok: false, error: "Keine Berechtigung für Kundendaten." };

  let payload;
  try {
    payload = parseCustomerEnrichInput({ company_name: company, city: city || undefined });
  } catch {
    return { ok: false, error: "Für die Recherche ist ein Firmenname erforderlich." };
  }
  const response = await proxyMeteredAiRequest({
    request: new Request("https://kreile.invalid/internal/customer-enrich", { method: "POST" }),
    identity,
    feature: "customer-enrich",
    payload,
    maxOutputTokens: 512,
    parseResult: parseCustomerEnrichmentResult,
  });
  return resultFromResponse(response, parseCustomerEnrichmentResult);
}
