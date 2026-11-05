import { describe, expect, it, vi } from "vitest";
import { analyzeWithAzureDocumentIntelligence } from "@/lib/server/azureDocumentIntelligence";
const env = { AZURE_DOCINTEL_ENDPOINT: "https://docs.example.invalid/", AZURE_DOCINTEL_KEY: "secret" };
describe("P63 Azure recognition boundary", () => {
  it("P63: retains actual OCR text without key-value pairs, including a HEIC document", async () => {
    const content = "SYNTHETISCH · Rechnung · Rechnungsnummer TEST-P63";
    const fetchPort = vi.fn().mockResolvedValueOnce(new Response(null, { status: 202,
      headers: { "operation-location": "https://docs.example.invalid/documentintelligence/documentModels/prebuilt-layout/analyzeResults/p63" } }))
      .mockResolvedValueOnce(Response.json({ status: "succeeded", analyzeResult: { content } }));
    const result = await analyzeWithAzureDocumentIntelligence(new Uint8Array([1]), "image/heic", env, fetchPort, async () => undefined);
    expect(result).toMatchObject({ code: "OK", data: { suggestions: [{ field: "DOCUMENT_TEXT", value: content }] } });
    expect(fetchPort).toHaveBeenCalledTimes(2);
  });

  it("P63: never sends structured XML to OCR", async () => {
    const fetchPort = vi.fn();
    expect(await analyzeWithAzureDocumentIntelligence(new TextEncoder().encode("<Invoice/>"), "application/xml", env, fetchPort)).toMatchObject({ code: "UNAVAILABLE" });
    expect(fetchPort).not.toHaveBeenCalled();
  });

});
