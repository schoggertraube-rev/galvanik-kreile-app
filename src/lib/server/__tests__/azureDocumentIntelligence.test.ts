import { describe, expect, it, vi } from "vitest";
import { analyzeWithAzureDocumentIntelligence, readAzureDocumentIntelligenceStatus } from "../azureDocumentIntelligence";

const env = { AZURE_DOCINTEL_ENDPOINT: "https://docs.example.invalid/", AZURE_DOCINTEL_KEY: "secret" };

describe("Azure Document Intelligence port", () => {
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

  it("fails closed when the preview connection is missing", () => {
    expect(readAzureDocumentIntelligenceStatus({})).toEqual({ code: "IN_KLAERUNG" });
  });

  it("returns source-bound suggestions only after a successful poll", async () => {
    const fetchPort = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 202,
        headers: { "operation-location": "https://docs.example.invalid/documentintelligence/documentModels/prebuilt-layout/analyzeResults/result-1?api-version=2024-11-30" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: "succeeded",
        analyzeResult: { keyValuePairs: [{
          key: { content: "Material", boundingRegions: [{ pageNumber: 2, polygon: [1, 2, 3, 4] }] },
          value: { content: "Messing", boundingRegions: [{ pageNumber: 2, polygon: [5, 6, 7, 8] }] },
          confidence: 0.93,
        }] },
      }), { status: 200 }));
    const result = await analyzeWithAzureDocumentIntelligence(new Uint8Array([37, 80, 68, 70]), "application/pdf", env, fetchPort, async () => undefined);
    expect(result).toEqual({ code: "OK", data: { suggestions: [{
      field: "MATERIAL", label: "Material", value: "Messing", confidence: 0.93,
      source: { page: 2, polygon: [5, 6, 7, 8] },
    }] } });
    const request = JSON.parse(String(fetchPort.mock.calls[0]?.[1]?.body));
    expect(request.base64Source).toBe("JVBERg==");
  });

  it("rejects operation URLs outside the configured Azure origin", async () => {
    const fetchPort = vi.fn().mockResolvedValueOnce(new Response(null, {
      status: 202,
      headers: { "operation-location": "https://untrusted.example.invalid/result" },
    }));
    await expect(analyzeWithAzureDocumentIntelligence(new Uint8Array([1]), "image/png", env, fetchPort, async () => undefined))
      .resolves.toEqual({ code: "UNAVAILABLE", message: "Das Dokument konnte mit Azure nicht sicher analysiert werden." });
    expect(fetchPort).toHaveBeenCalledTimes(1);
  });
});
