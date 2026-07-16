import { GoogleGenAI } from "@google/genai";

type GenerateContentOptions = Parameters<GoogleGenAI["models"]["generateContent"]>[0];

function providerErrorDetails(error: unknown): { status?: number; message: string } {
  if (!error || typeof error !== "object") return { message: "Unknown provider error" };
  const value = error as Record<string, unknown>;
  return {
    ...(typeof value.status === "number" ? { status: value.status } : {}),
    message: typeof value.message === "string" ? value.message : "Unknown provider error",
  };
}

export class GeminiQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiQuotaError";
  }
}

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiConfigError";
  }
}

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiConfigError("API-Key (GEMINI_API_KEY) fehlt in der Umgebung.");
  }
  return new GoogleGenAI({ apiKey });
}

export function getPrimaryGeminiModel() {
  return process.env.GEMINI_MODEL_PRIMARY || process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

export function getFallbackGeminiModel() {
  return process.env.GEMINI_MODEL_FALLBACK || "gemini-2.5-flash-lite";
}

export async function generateGeminiContentWithFallback(options: {
  contents: GenerateContentOptions["contents"];
  config?: GenerateContentOptions["config"];
}) {
  const ai = getGeminiClient();
  const primaryModel = getPrimaryGeminiModel();
  const fallbackModel = getFallbackGeminiModel();

  try {
    const response = await ai.models.generateContent({
      model: primaryModel,
      contents: options.contents,
      config: options.config,
    });
    return response;
  } catch (error) {
    const details = providerErrorDetails(error);
    const isOverloadedOrQuota = 
      details.status === 429 ||
      details.status === 503 ||
      details.message.includes("Quota exceeded") ||
      details.message.includes("RESOURCE_EXHAUSTED") ||
      details.message.includes("high demand") ||
      details.message.includes("UNAVAILABLE");

    if (isOverloadedOrQuota && primaryModel !== fallbackModel) {
      console.warn(`[Gemini] Primary model ${primaryModel} failed (${details.status || 'Overloaded'}). Falling back to ${fallbackModel}...`);
      
      // Remove Google Search tools in fallback to ensure it succeeds if Search was the issue
      const fallbackConfig = options.config ? { ...options.config, tools: undefined } : undefined;

      try {
        const fallbackResponse = await ai.models.generateContent({
          model: fallbackModel,
          contents: options.contents,
          config: fallbackConfig,
        });
        return fallbackResponse;
      } catch (fallbackError) {
        console.error(`[Gemini] Fallback model ${fallbackModel} also failed:`, providerErrorDetails(fallbackError).message);
        throw new GeminiQuotaError("Gemini-Kontingent erreicht. Analyse aktuell nicht möglich.");
      }
    }
    
    // Not a quota/overload error, or primary == fallback
    throw error;
  }
}

/**
 * Executes a Gemini AI request in a cost-controlled and secure manner.
 * 
 * @param prompt The complete prompt to send to the model
 * @param requireWebSearch Whether the model is allowed to use Google Search Grounding.
 *                         This will only activate if ENABLE_GEMINI_GOOGLE_SEARCH=true
 */
export type GeneratedAiResponse = {
  text: string;
  actualUnits: number | null;
  providerStatus: string;
};

export async function generateAiResponse(prompt: string, requireWebSearch: boolean = false): Promise<GeneratedAiResponse> {
  const searchEnabledGlobally = process.env.ENABLE_GEMINI_GOOGLE_SEARCH === "true";
  const tools = (requireWebSearch && searchEnabledGlobally) ? [{ googleSearch: {} }] : undefined;

  try {
    const response = await generateGeminiContentWithFallback({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        tools: tools,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const responseMetadata = response as { usageMetadata?: { totalTokenCount?: unknown }; modelVersion?: unknown };
    const totalTokenCount = Number(responseMetadata.usageMetadata?.totalTokenCount);
    const modelVersion = typeof responseMetadata.modelVersion === "string" && responseMetadata.modelVersion.trim()
      ? responseMetadata.modelVersion.trim().slice(0, 80)
      : "gemini";
    return {
      text,
      actualUnits: Number.isSafeInteger(totalTokenCount) && totalTokenCount >= 0 ? totalTokenCount : null,
      providerStatus: modelVersion,
    };
  } catch (error) {
    const details = providerErrorDetails(error);
    if (error instanceof GeminiQuotaError) {
      throw error;
    }
    if (details.status === 429 || details.message.includes("Quota exceeded")) {
      throw new GeminiQuotaError("Gemini-Kontingent erreicht. Analyse ohne Websuche oder später erneut versuchen.");
    }
    throw error;
  }
}
