import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors, requireServiceRole } from "../_shared/security.ts";
import {
  claimAiUsage,
  exactObject,
  parseInternalAiBody,
  requiredText,
  settleAiUsage,
} from "../_shared/aiUsage.ts";
import { generateGeminiJson } from "../_shared/geminiJson.ts";

const FEATURE = "notes-extract";
const CATEGORIES = new Set([
  "pickup_request", "status_question", "payment_question", "complaint", "callback",
  "new_order_intake", "new_customer_request", "quote_request", "email_review",
  "attachment_review", "photo_review", "document_review", "appointment_request",
  "deadline_request", "material_or_surface_info", "shipping_question",
  "technical_question", "general",
]);

function parseInput(value: unknown) {
  const input = exactObject(value, ["text"]);
  return { text: requiredText(input.text, 12_000) };
}

function outputText(value: unknown, maximum: number, nullable = false): string | null {
  if (nullable && (value === null || value === undefined)) return null;
  if (typeof value !== "string") throw new Error("INVALID_AI_RESULT");
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error("INVALID_AI_RESULT");
  }
  return normalized;
}

function parsePhoneNoteResult(value: unknown): Record<string, unknown> {
  const result = exactObject(value, [
    "category", "material", "surfaceRequested", "suggestedAnswer", "overallConfidence",
  ]);
  if (
    typeof result.category !== "string" || !CATEGORIES.has(result.category)
    || typeof result.overallConfidence !== "number"
    || !Number.isInteger(result.overallConfidence)
    || result.overallConfidence < 0
    || result.overallConfidence > 100
  ) {
    throw new Error("INVALID_AI_RESULT");
  }
  return {
    category: result.category,
    material: outputText(result.material, 120, true),
    surfaceRequested: outputText(result.surfaceRequested, 160, true),
    suggestedAnswer: outputText(result.suggestedAnswer, 2_000),
    overallConfidence: result.overallConfidence,
  };
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
    return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }

  try {
    if (!await claimAiUsage(parsed.usage)) {
      return new Response(JSON.stringify({ error: "Usage reservation unavailable" }), { status: 409, headers: { ...cors, "Content-Type": "application/json" } });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Usage accounting unavailable" }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
  }

  try {
    const generated = await generateGeminiJson({
      prompt: `Analysiere ausschließlich den folgenden Text einer Telefonnotiz für eine Galvanik-Werkstatt.
Erfinde keine Kunden-, Auftrags-, Termin-, Lager-, Zahlungs- oder Kommunikationsdaten und behaupte nicht, dass eine Folgeaktion ausgeführt wurde.
Antworte ausschließlich als JSON-Objekt mit exakt diesen Feldern:
- category: eine der Kategorien pickup_request, status_question, payment_question, complaint, callback, new_order_intake, new_customer_request, quote_request, email_review, attachment_review, photo_review, document_review, appointment_request, deadline_request, material_or_surface_info, shipping_question, technical_question, general
- material: im Text ausdrücklich genanntes Material oder null
- surfaceRequested: im Text ausdrücklich genanntes Verfahren/Oberfläche oder null
- suggestedAnswer: kurzer deutscher Formulierungsvorschlag; unbekannte Fakten ausdrücklich als noch zu prüfen benennen
- overallConfidence: ganze Zahl von 0 bis 100

Telefonnotiz:
${parsed.input.text}`,
      maxOutputTokens: 1_024,
      temperature: 0.1,
    });
    const result = parsePhoneNoteResult(generated.result);
    await settleAiUsage({ usage: parsed.usage, outcome: "succeeded", actualUnits: generated.actualUnits, providerStatus: generated.providerStatus, result });
    return new Response(JSON.stringify(result), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch {
    try {
      await settleAiUsage({ usage: parsed.usage, outcome: "uncertain", actualUnits: null, providerStatus: "gemini-error" });
    } catch {
      // Accounting failure remains fail-closed.
    }
    return new Response(JSON.stringify({ error: "AI provider unavailable" }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
