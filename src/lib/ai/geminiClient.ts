/**
 * AI execution has no approved tenant, consent, data-minimisation, or billing
 * contract. This import-free boundary intentionally cannot call a provider.
 */
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

export type GeminiContentRequest = {
  contents: unknown;
  config?: Record<string, unknown>;
};

export type GeminiContentResponse = {
  text?: string;
};

function unavailable(): never {
  throw new GeminiConfigError("NOT_CONFIGURED: KI-Ausfuehrung ist bis zum geprueften Vertrag gesperrt.");
}

export function getGeminiClient(): never {
  return unavailable();
}

export function getPrimaryGeminiModel(): string {
  return "NOT_CONFIGURED";
}

export function getFallbackGeminiModel(): string {
  return "NOT_CONFIGURED";
}

export async function generateGeminiContentWithFallback(_options: GeminiContentRequest): Promise<GeminiContentResponse> {
  void _options;
  return unavailable();
}

export async function generateAiResponse(_prompt: string, _requireWebSearch = false): Promise<string> {
  void _prompt;
  void _requireWebSearch;
  return unavailable();
}
