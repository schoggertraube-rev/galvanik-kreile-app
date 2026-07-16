import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { corsHeaders, handleCors, requireServiceRole } from "../_shared/security.ts";
import { exactObject } from "../_shared/aiUsage.ts";
import { generateGeminiJson } from "../_shared/geminiJson.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BYTES = 12 * 1024 * 1024;

type ClaimRow = {
  claimed: boolean;
  replay: boolean;
  job_status: string;
  storage_path: string | null;
  mime_type: string | null;
  replay_result: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validImage(bytes: Uint8Array, mime: string): boolean {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => bytes[index] === value);
  }
  if (mime === "image/webp") {
    return [0x52, 0x49, 0x46, 0x46].every((value, index) => bytes[index] === value) &&
      [0x57, 0x45, 0x42, 0x50].every((value, index) => bytes[index + 8] === value);
  }
  return false;
}

function validateResult(value: Record<string, unknown>): Record<string, unknown> {
  const result = exactObject(value, ["material", "schaeden", "masse", "confidence"]);
  for (const key of ["material", "schaeden", "masse"] as const) {
    const field = result[key];
    if (field !== null && (typeof field !== "string" || field.length > 2_000)) {
      throw new Error("INVALID_ITEM_PHOTO_RESULT");
    }
  }
  if (typeof result.confidence !== "number" || result.confidence < 0 || result.confidence > 1) {
    throw new Error("INVALID_ITEM_PHOTO_RESULT");
  }
  return result;
}

serve(async (req) => {
  const cors = corsHeaders(req);
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const unauthorized = requireServiceRole(req);
  if (unauthorized) return unauthorized;

  let jobId: string;
  try {
    const body = exactObject(await req.json(), ["jobId"]);
    if (typeof body.jobId !== "string" || !UUID_PATTERN.test(body.jobId)) throw new Error();
    jobId = body.jobId;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) {
    return new Response(JSON.stringify({ error: "Photo analysis unavailable" }), {
      status: 503,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claimData, error: claimError } = await supabase.rpc("claim_item_photo_analysis", {
    p_job_id: jobId,
  });
  if (claimError || !Array.isArray(claimData) || claimData.length !== 1 || !isObject(claimData[0])) {
    return new Response(JSON.stringify({ error: "Photo accounting unavailable" }), {
      status: 503,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const claim = claimData[0] as ClaimRow;
  if (claim.replay === true && isObject(claim.replay_result)) {
    return new Response(JSON.stringify(claim.replay_result), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store", "X-Item-Photo-Replay": "1" },
    });
  }
  if (
    claim.claimed !== true ||
    typeof claim.storage_path !== "string" || claim.storage_path.length > 600 ||
    !claim.storage_path.startsWith("galvanik-kreile/") || claim.storage_path.includes("..") || claim.storage_path.includes("\\") ||
    (claim.mime_type !== "image/jpeg" && claim.mime_type !== "image/png" && claim.mime_type !== "image/webp")
  ) {
    return new Response(JSON.stringify({ error: "Photo job is not claimable" }), {
      status: 409,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let providerStarted = false;
  try {
    const { data: stored, error: downloadError } = await supabase.storage
      .from("item-photos")
      .download(claim.storage_path);
    if (downloadError || !stored || stored.size < 12 || stored.size > MAX_BYTES) {
      throw new Error("ITEM_PHOTO_STORAGE_INVALID");
    }
    const bytes = new Uint8Array(await stored.arrayBuffer());
    if (bytes.byteLength !== stored.size || !validImage(bytes, claim.mime_type)) {
      throw new Error("ITEM_PHOTO_STORAGE_INVALID");
    }

    providerStarted = true;
    const generated = await generateGeminiJson({
      prompt: "Analysiere dieses Foto eines Werkstücks für einen Galvanikbetrieb. Beschreibe nur visuell belegbare Merkmale; erfinde weder Material noch Maße. Antworte als JSON-Objekt mit material, schaeden, masse und confidence (0 bis 1). Unsichere Angaben müssen null sein.",
      maxOutputTokens: 512,
      temperature: 0.1,
      inlineData: { mimeType: claim.mime_type, data: encode(bytes) },
    });
    const result = validateResult(generated.result);
    const { data: settlement, error: settlementError } = await supabase.rpc("settle_item_photo_analysis", {
      p_job_id: jobId,
      p_outcome: "succeeded",
      p_actual_units: generated.actualUnits,
      p_provider_status: generated.providerStatus,
      p_result: result,
    });
    if (settlementError || !Array.isArray(settlement) || settlement.length !== 1) {
      throw new Error("ITEM_PHOTO_SETTLEMENT_UNAVAILABLE");
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    try {
      await supabase.rpc("settle_item_photo_analysis", {
        p_job_id: jobId,
        p_outcome: providerStarted ? "uncertain" : "failed",
        p_actual_units: null,
        p_provider_status: providerStarted ? "gemini-error" : "pre-provider-error",
        p_result: null,
      });
    } catch {
      // The request remains fail-closed even if settlement is unavailable.
    }
    return new Response(JSON.stringify({ error: "Photo analysis unavailable" }), {
      status: 503,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
