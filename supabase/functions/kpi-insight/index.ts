import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors, requireUserOrServiceRole } from "../_shared/security.ts";
import {
  claimAiUsage,
  exactObject,
  reserveDirectAiUsage,
  settleAiUsage,
  type AiUsageEnvelope,
} from "../_shared/aiUsage.ts";
import { generateGeminiJson } from "../_shared/geminiJson.ts";

const FEATURE = "kpi-insight";

function parseInput(value: unknown): { kachel: "werkstatt-puls"; daten: Record<string, number | string | null> } {
  const input = exactObject(value, ["kachel", "daten"]);
  if (input.kachel !== "werkstatt-puls") throw new Error("INVALID_AI_REQUEST");
  if (!input.daten || typeof input.daten !== "object" || Array.isArray(input.daten)) {
    throw new Error("INVALID_AI_REQUEST");
  }
  const daten = input.daten as Record<string, unknown>;
  const entries = Object.entries(daten);
  if (entries.length < 1 || entries.length > 40 || JSON.stringify(daten).length > 8_192) {
    throw new Error("INVALID_AI_REQUEST");
  }
  for (const [key, item] of entries) {
    if (!/^[A-Za-z0-9äöüÄÖÜß _.-]{1,80}$/.test(key)) throw new Error("INVALID_AI_REQUEST");
    if (item === null) continue;
    if (typeof item === "number" && Number.isFinite(item) && Math.abs(item) <= 1_000_000_000_000) continue;
    if (typeof item === "string" && item.length <= 500) continue;
    throw new Error("INVALID_AI_REQUEST");
  }
  return { kachel: "werkstatt-puls", daten: daten as Record<string, number | string | null> };
}

function validateResult(value: Record<string, unknown>): Record<string, unknown> {
  const result = exactObject(value, ["beobachtung", "achtung", "empfehlung"]);
  if (
    typeof result.beobachtung !== "string" || !result.beobachtung.trim() || result.beobachtung.length > 1_000 ||
    typeof result.empfehlung !== "string" || !result.empfehlung.trim() || result.empfehlung.length > 1_000 ||
    (result.achtung !== undefined && result.achtung !== null && (typeof result.achtung !== "string" || result.achtung.length > 1_000))
  ) {
    throw new Error("INVALID_AI_RESULT");
  }
  return result;
}

serve(async (req) => {
  const cors = corsHeaders(req);
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const auth = await requireUserOrServiceRole(req);
  if (!auth.ok) return auth.response;

  let input;
  try {
    input = parseInput(await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }

  let admission;
  try {
    admission = await reserveDirectAiUsage({
      request: req,
      identity: auth.identity,
      feature: FEATURE,
      payload: input,
      maxOutputTokens: 384,
    });
  } catch (error) {
    const status = error instanceof Error && error.message === "INVALID_IDEMPOTENCY_KEY" ? 400 : 503;
    return new Response(JSON.stringify({ error: status === 400 ? "Invalid idempotency key" : "Usage accounting unavailable" }), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (admission.kind === "replay") {
    return new Response(JSON.stringify(admission.result), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store", "X-AI-Replay": "1" },
    });
  }
  if (admission.kind === "rejected") {
    return new Response(JSON.stringify({ error: "AI usage limit reached" }), {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(admission.retryAfterSeconds) },
    });
  }

  const usage: AiUsageEnvelope = {
    reservationId: admission.reservationId,
    tenantId: auth.identity.tenantId,
    userId: auth.identity.userId,
    feature: FEATURE,
  };
  try {
    if (!await claimAiUsage(usage)) {
      return new Response(JSON.stringify({ error: "Usage reservation unavailable" }), { status: 409, headers: { ...cors, "Content-Type": "application/json" } });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Usage accounting unavailable" }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
  }

  try {
    const generated = await generateGeminiJson({
      prompt: `Du bist Betriebsberater für einen Galvanik-Meisterbetrieb. Nutze ausschließlich die übergebenen Werte; erfinde keine Zahlen und benenne fehlende Datengrundlagen offen. Antworte auf Deutsch als JSON-Objekt mit beobachtung, optional achtung und empfehlung.\n\nBereich: ${input.kachel}\nDaten: ${JSON.stringify(input.daten)}`,
      maxOutputTokens: 384,
      temperature: 0.3,
    });
    const result = validateResult(generated.result);
    await settleAiUsage({ usage, outcome: "succeeded", actualUnits: generated.actualUnits, providerStatus: generated.providerStatus, result });
    return new Response(JSON.stringify(result), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch {
    try {
      await settleAiUsage({ usage, outcome: "uncertain", actualUnits: null, providerStatus: "gemini-error" });
    } catch {
      // Accounting failure remains fail-closed.
    }
    return new Response(JSON.stringify({ error: "AI provider unavailable" }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
