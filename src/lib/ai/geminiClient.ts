import { GoogleGenAI, type ContentListUnion, type GenerateContentConfig } from "@google/genai";

interface GeminiErrorDetails {
  status?: number;
  message?: string;
}

function getGeminiErrorDetails(error: unknown): GeminiErrorDetails {
  if (typeof error !== "object" || error === null) {
    return {};
  }

  const details = error as Record<string, unknown>;
  return {
    status: typeof details.status === "number" ? details.status : undefined,
    message: typeof details.message === "string" ? details.message : undefined,
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
  contents: ContentListUnion;
  config?: GenerateContentConfig;
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
  } catch (error: unknown) {
    const primaryError = getGeminiErrorDetails(error);
    const isOverloadedOrQuota =
      primaryError.status === 429 ||
      primaryError.status === 503 ||
      primaryError.message?.includes("Quota exceeded") ||
      primaryError.message?.includes("RESOURCE_EXHAUSTED") ||
      primaryError.message?.includes("high demand") ||
      primaryError.message?.includes("UNAVAILABLE");

    if (isOverloadedOrQuota && primaryModel !== fallbackModel) {
      console.warn(`[Gemini] Primary model ${primaryModel} failed (${primaryError.status || 'Overloaded'}). Falling back to ${fallbackModel}...`);
      
      // Remove Google Search tools in fallback to ensure it succeeds if Search was the issue
      const fallbackConfig = { ...options.config };
      if (fallbackConfig.tools) {
        delete fallbackConfig.tools;
      }

      try {
        const fallbackResponse = await ai.models.generateContent({
          model: fallbackModel,
          contents: options.contents,
          config: fallbackConfig,
        });
        return fallbackResponse;
      } catch (fallbackError: unknown) {
        console.error(`[Gemini] Fallback model ${fallbackModel} also failed:`, getGeminiErrorDetails(fallbackError).message);
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
export async function generateAiResponse(prompt: string, requireWebSearch: boolean = false): Promise<string> {
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

    return text;
  } catch (error: unknown) {
    const geminiError = getGeminiErrorDetails(error);
    if (error instanceof GeminiQuotaError) {
      throw error;
    }
    if (geminiError.status === 429 || geminiError.message?.includes("Quota exceeded")) {
      throw new GeminiQuotaError("Gemini-Kontingent erreicht. Analyse ohne Websuche oder später erneut versuchen.");
    }
    throw error;
  }
}
