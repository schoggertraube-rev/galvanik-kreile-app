import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("customer AI action truth boundary", () => {
  it("uses the metered service boundary instead of a direct unaccounted model call", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/actions/ai-enrichment.actions.ts"), "utf8");
    expect(source).toContain("proxyMeteredAiRequest");
    expect(source).toContain("perm_data_customers");
    expect(source).toContain("parseCustomerEnrichmentResult");
    expect(source).not.toContain("GoogleGenerativeAI");
    expect(source).not.toContain("GEMINI_API_KEY");
  });

  it("requires provider grounding sources before applying researched fields", () => {
    const edge = readFileSync(resolve(process.cwd(), "supabase/functions/customer-enrich/index.ts"), "utf8");
    const shared = readFileSync(resolve(process.cwd(), "supabase/functions/_shared/geminiJson.ts"), "utf8");
    expect(edge).toContain("groundingSources.length === 0");
    expect(shared).toContain("candidate.groundingMetadata");
    expect(shared).toContain("groundingChunks");
  });
});
