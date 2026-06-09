import { GoogleGenAI } from "@google/genai";

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
  contents: any;
  config?: any;
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
  } catch (error: any) {
    const isOverloadedOrQuota = 
      error?.status === 429 || 
      error?.status === 503 || 
      error?.message?.includes("Quota exceeded") || 
      error?.message?.includes("RESOURCE_EXHAUSTED") ||
      error?.message?.includes("high demand") ||
      error?.message?.includes("UNAVAILABLE");

    if (isOverloadedOrQuota && primaryModel !== fallbackModel) {
      console.warn(`[Gemini] Primary model ${primaryModel} failed (${error?.status || 'Overloaded'}). Falling back to ${fallbackModel}...`);
      
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
      } catch (fallbackError: any) {
        console.error(`[Gemini] Fallback model ${fallbackModel} also failed:`, fallbackError.message);
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
  } catch (error: any) {
    if (error instanceof GeminiQuotaError) {
      throw error;
    }
    if (error?.status === 429 || error?.message?.includes("Quota exceeded")) {
      throw new GeminiQuotaError("Gemini-Kontingent erreicht. Analyse ohne Websuche oder später erneut versuchen.");
    }
    throw error;
  }
}
