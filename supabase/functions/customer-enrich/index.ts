import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors, requireServiceRole } from "../_shared/security.ts";
import {
  claimAiUsage,
  exactObject,
  optionalText,
  parseInternalAiBody,
  settleAiUsage,
} from "../_shared/aiUsage.ts";
import { generateGeminiJson } from "../_shared/geminiJson.ts";

const FEATURE = "customer-enrich";

function parseInput(value: unknown) {
  const input = exactObject(value, ["name", "company_name", "city"]);
  const name = optionalText(input.name, 160);
  const companyName = optionalText(input.company_name, 200);
  const city = optionalText(input.city, 120);
  if (!name && !companyName) throw new Error("INVALID_AI_REQUEST");
  return { name, companyName, city };
}

function nullableText(value: unknown, maximum: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("INVALID_AI_RESULT");
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) throw new Error("INVALID_AI_RESULT");
  return normalized;
}

function validateResult(value: unknown): Record<string, unknown> {
  const result = exactObject(value, ["website", "phone", "email", "street", "zipCode", "city", "country", "confidence", "groundingSources"]);
  const website = nullableText(result.website, 2_048);
  const email = nullableText(result.email, 320);
  if (website && !/^https?:\/\//.test(website)) throw new Error("INVALID_AI_RESULT");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INVALID_AI_RESULT");
  if (result.country !== null && result.country !== undefined && !["DE", "AT", "CH"].includes(String(result.country))) throw new Error("INVALID_AI_RESULT");
  if (typeof result.confidence !== "number" || !Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1) throw new Error("INVALID_AI_RESULT");
  if (!Array.isArray(result.groundingSources) || result.groundingSources.length > 20) throw new Error("INVALID_AI_RESULT");
  const groundingSources = result.groundingSources.map((entry) => {
    const source = exactObject(entry, ["url", "title"]);
    if (typeof source.url !== "string" || !source.url.startsWith("https://") || source.url.length > 2_048) throw new Error("INVALID_AI_RESULT");
    return { url: source.url, title: nullableText(source.title, 300) };
  });
  const normalized = {
    website,
    phone: nullableText(result.phone, 80),
    email,
    street: nullableText(result.street, 240),
    zipCode: nullableText(result.zipCode, 20),
    city: nullableText(result.city, 160),
    country: result.country ?? null,
    confidence: result.confidence,
    groundingSources,
  };
  if ([normalized.website, normalized.phone, normalized.email, normalized.street, normalized.zipCode, normalized.city].some(Boolean) && groundingSources.length === 0) {
    throw new Error("INVALID_AI_RESULT");
  }
  return normalized;
}

serve(async (req) => {
  const cors = corsHeaders(req);
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const unauthorized = requireServiceRole(req);
  if (unauthorized) return unauthorized;

  let parsed;
  try {
    parsed = parseInternalAiBody(await req.json(), FEATURE, parseInput);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    if (!await claimAiUsage(parsed.usage)) {
      return new Response(JSON.stringify({ error: "Usage reservation unavailable" }), {
        status: 409,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Usage accounting unavailable" }), {
      status: 503,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const generated = await generateGeminiJson({
      prompt: `Du recherchierst öffentliche Geschäftskontaktdaten mit Google Search Grounding. Verwende nur Angaben, die von den tatsächlich gefundenen Quellen getragen werden. Erfinde nichts; nicht belegte Werte sind null.\n\nFirma: ${parsed.input.companyName ?? parsed.input.name ?? ""}\nName: ${parsed.input.name ?? ""}\nStadt: ${parsed.input.city ?? "unbekannt"}\n\nAntworte ausschließlich als JSON-Objekt mit exakt diesen Feldern: website, phone, email, street, zipCode, city, country und confidence. country ist DE, AT, CH oder null. confidence ist eine Zahl von 0 bis 1. Quellen werden serverseitig aus dem Grounding ergänzt und dürfen nicht im JSON stehen.`,
      maxOutputTokens: 512,
      temperature: 0.2,
      googleSearch: true,
    });
    const result = validateResult(generated.result);
    await settleAiUsage({
      usage: parsed.usage,
      outcome: "succeeded",
      actualUnits: generated.actualUnits,
      providerStatus: generated.providerStatus,
      result,
    });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch {
    try {
      await settleAiUsage({
        usage: parsed.usage,
        outcome: "uncertain",
        actualUnits: null,
        providerStatus: "gemini-error",
      });
    } catch {
      // Keep the request fail-closed when accounting itself is unavailable.
    }
    return new Response(JSON.stringify({ error: "AI provider unavailable" }), {
      status: 503,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
