export type GeminiJsonResult = {
  result: Record<string, unknown>;
  actualUnits: number | null;
  providerStatus: string;
};

type GeminiJsonInput = {
  prompt: string;
  maxOutputTokens: number;
  temperature: number;
  googleSearch?: boolean;
  inlineData?: {
    mimeType: "image/jpeg" | "image/png" | "image/webp";
    data: string;
  };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function generateGeminiJson(input: GeminiJsonInput): Promise<GeminiJsonResult> {
  if (
    !input.prompt || input.prompt.length > 50_000 ||
    !Number.isInteger(input.maxOutputTokens) || input.maxOutputTokens < 1 || input.maxOutputTokens > 4_096 ||
    !Number.isFinite(input.temperature) || input.temperature < 0 || input.temperature > 1 ||
    (input.inlineData !== undefined && (
      !["image/jpeg", "image/png", "image/webp"].includes(input.inlineData.mimeType) ||
      !input.inlineData.data || input.inlineData.data.length > 16_777_216 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(input.inlineData.data)
    ))
  ) {
    throw new Error("INVALID_GEMINI_REQUEST");
  }
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_NOT_CONFIGURED");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: input.prompt },
            ...(input.inlineData ? [{ inlineData: input.inlineData }] : []),
          ],
        }],
        ...(input.googleSearch ? { tools: [{ googleSearch: {} }] } : {}),
        generationConfig: {
          temperature: input.temperature,
          responseMimeType: "application/json",
          maxOutputTokens: input.maxOutputTokens,
        },
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    },
  );
  const responseText = await response.text();
  if (responseText.length > 1_048_576) throw new Error("GEMINI_RESPONSE_TOO_LARGE");
  if (!response.ok) throw new Error("GEMINI_PROVIDER_ERROR");

  let providerPayload: unknown;
  try {
    providerPayload = JSON.parse(responseText);
  } catch {
    throw new Error("GEMINI_RESPONSE_INVALID");
  }
  if (!isObject(providerPayload)) throw new Error("GEMINI_RESPONSE_INVALID");
  const candidates = providerPayload.candidates;
  const candidate = Array.isArray(candidates) && isObject(candidates[0]) ? candidates[0] : null;
  const content = candidate && isObject(candidate.content) ? candidate.content : null;
  const parts = content?.parts;
  const firstPart = Array.isArray(parts) && isObject(parts[0]) ? parts[0] : null;
  if (!firstPart || typeof firstPart.text !== "string" || firstPart.text.length > 262_144) {
    throw new Error("GEMINI_RESPONSE_INVALID");
  }

  let result: unknown;
  try {
    result = JSON.parse(firstPart.text);
  } catch {
    throw new Error("GEMINI_RESULT_INVALID");
  }
  if (!isObject(result)) throw new Error("GEMINI_RESULT_INVALID");

  const groundingSources: { url: string; title: string | null }[] = [];
  if (input.googleSearch) {
    const groundingMetadata = candidate && isObject(candidate.groundingMetadata)
      ? candidate.groundingMetadata
      : null;
    const chunks = groundingMetadata?.groundingChunks;
    const seen = new Set<string>();
    if (Array.isArray(chunks)) {
      for (const chunk of chunks.slice(0, 20)) {
        const web = isObject(chunk) && isObject(chunk.web) ? chunk.web : null;
        if (!web || typeof web.uri !== "string" || !web.uri.startsWith("https://") || web.uri.length > 2_048 || seen.has(web.uri)) continue;
        seen.add(web.uri);
        groundingSources.push({
          url: web.uri,
          title: typeof web.title === "string" && web.title.length <= 300 ? web.title : null,
        });
      }
    }
  }

  const usage = isObject(providerPayload.usageMetadata) ? providerPayload.usageMetadata : null;
  const totalTokens = usage?.totalTokenCount;
  const actualUnits = typeof totalTokens === "number" && Number.isSafeInteger(totalTokens) && totalTokens >= 0
    ? Math.min(totalTokens, 100_000)
    : null;
  return {
    result: input.googleSearch ? { ...result, groundingSources } : result,
    actualUnits,
    providerStatus: `gemini-2.5-flash:${response.status}`,
  };
}
