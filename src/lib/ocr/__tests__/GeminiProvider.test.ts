import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGenerate } = vi.hoisted(() => ({ mockGenerate: vi.fn() }));

vi.mock("@/lib/ai/geminiClient", () => ({
  generateGeminiContentWithFallback: mockGenerate,
}));

import { GeminiProvider } from "@/lib/ocr/GeminiProvider";

describe("GeminiProvider fail-closed behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPABASE_URL", "https://example.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects an unavailable storage object instead of returning a persistable fallback receipt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("missing", { status: 404, statusText: "Not Found" })));
    await expect(new GeminiProvider().extractBeleg("https://example.test/missing.jpg"))
      .rejects.toThrow("Stored receipt could not be loaded");
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("rejects an empty provider response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/jpeg" },
    })));
    mockGenerate.mockResolvedValue({ text: "" });

    await expect(new GeminiProvider().extractBeleg("https://example.test/receipt.jpg"))
      .rejects.toThrow("Gemini OCR response is empty or too large");
  });

  it("still maps a successful provider response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/jpeg" },
    })));
    mockGenerate.mockResolvedValue({
      text: JSON.stringify({
        lieferant: "Lieferant GmbH",
        datum: "2026-07-15",
        brutto: 119,
        netto: 100,
        ustSatz: 19,
        ustBetrag: 19,
        rohtext: "Lieferant GmbH Rechnung 119 EUR",
        positionen: [],
      }),
    });

    await expect(new GeminiProvider().extractBeleg("https://example.test/receipt.jpg"))
      .resolves.toMatchObject({ lieferant: "Lieferant GmbH", confidence: 0 });
  });
});
