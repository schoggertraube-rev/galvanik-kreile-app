import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors, requireServiceRole } from "../_shared/security.ts";
import {
  claimAiUsage,
  exactObject,
  optionalText,
  parseInternalAiBody,
  requiredText,
  settleAiUsage,
} from "../_shared/aiUsage.ts";
import { generateGeminiJson } from "../_shared/geminiJson.ts";

const FEATURE = "inquiry-extract";

function parseInput(value: unknown) {
  const input = exactObject(value, ["text", "subject"]);
  return {
    text: requiredText(input.text, 12_000),
    subject: optionalText(input.subject, 300),
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
      prompt: `Extrahiere ausschließlich belegte Angaben aus dieser Anfrage an einen Galvanikbetrieb. Erfinde keine Werte. Antworte als JSON-Objekt mit customer, items, order und behaviorNote.\n\nBetreff: ${parsed.input.subject ?? "kein Betreff"}\nText:\n${parsed.input.text}`,
      maxOutputTokens: 1_024,
      temperature: 0.1,
    });
    await settleAiUsage({ usage: parsed.usage, outcome: "succeeded", actualUnits: generated.actualUnits, providerStatus: generated.providerStatus, result: generated.result });
    return new Response(JSON.stringify(generated.result), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch {
    try {
      await settleAiUsage({ usage: parsed.usage, outcome: "uncertain", actualUnits: null, providerStatus: "gemini-error" });
    } catch {
      // Accounting failure remains fail-closed.
    }
    return new Response(JSON.stringify({ error: "AI provider unavailable" }), { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
