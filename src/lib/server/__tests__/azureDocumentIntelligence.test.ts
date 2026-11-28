import { describe, expect, it, vi } from "vitest";
import { analyzeWithAzureDocumentIntelligence, readAzureDocumentIntelligenceStatus, readAzureRecognitionOriginal } from "../azureDocumentIntelligence";

const env = { AZURE_DOCINTEL_ENDPOINT: "https://docs.example.invalid/", AZURE_DOCINTEL_KEY: "secret" };

describe("Azure Document Intelligence port", () => {
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
    const result = await analyzeWithAzureDocumentIntelligence(new Uint8Array([37, 80, 68, 70]), "application/pdf", "prebuilt-layout", env, fetchPort, async () => undefined);
    expect(result.code).toBe("OK");
    if (result.code !== "OK") throw Error("TEST_RECOGNITION_FAILED");
    expect(result.data).toEqual({ suggestions: [{
      field: "MATERIAL", label: "Material", value: "Messing", confidence: 0.93,
      source: { page: 2, polygon: [5, 6, 7, 8] },
    }] });
    const request = JSON.parse(String(fetchPort.mock.calls[0]?.[1]?.body));
    expect(request.base64Source).toBe("JVBERg==");
  });

  it("rejects operation URLs outside the configured Azure origin", async () => {
    const fetchPort = vi.fn().mockResolvedValueOnce(new Response(null, {
      status: 202,
      headers: { "operation-location": "https://untrusted.example.invalid/result" },
    }));
    await expect(analyzeWithAzureDocumentIntelligence(new Uint8Array([1]), "image/png", "prebuilt-layout", env, fetchPort, async () => undefined))
      .resolves.toEqual({ code: "UNAVAILABLE", message: "Das Dokument konnte mit Azure nicht sicher analysiert werden." });
    expect(fetchPort).toHaveBeenCalledTimes(1);
  });

  it("retains a field without assigning it to an unproven PDF page", () => {
    const value = { content: "TEST-RE-18" };
    const payload = new TextEncoder().encode(JSON.stringify({ status: "succeeded", analyzeResult: {
      pages: [{ pageNumber: 1 }, { pageNumber: 2 }],
      keyValuePairs: [{ key: { content: "Rechnungsnummer" }, value }],
    } }));
    const original = readAzureRecognitionOriginal(payload, "prebuilt-layout");
    expect(original.data.suggestions).toEqual([expect.objectContaining({
      value: "TEST-RE-18", source: { page: null, polygon: [] },
    })]);
  });

  it("retains every recognized field and complete document text", async () => {
    const text = "TEST Beleginhalt\n".repeat(1500) + "TEST letzte Belegzeile";
    const finalValue = "TEST Material ".repeat(100) + "TEST letzter Wert";
    const pairs = Array.from({ length: 85 }, (_, index) => ({
      key: { content: `Material ${index + 1}` },
      value: { content: index === 84 ? finalValue : `TEST Material ${index + 1}` },
      confidence: 0.8,
    }));
    const fetchPort = vi.fn().mockResolvedValueOnce(new Response(null, {
      status: 202,
      headers: { "operation-location": "https://docs.example.invalid/documentintelligence/documentModels/prebuilt-layout/analyzeResults/full" },
    })).mockResolvedValueOnce(Response.json({
      status: "succeeded",
      analyzeResult: { content: text, keyValuePairs: pairs },
    }));

    const result = await analyzeWithAzureDocumentIntelligence(new Uint8Array([1]), "application/pdf", "prebuilt-layout", env, fetchPort);

    expect(result.code).toBe("OK");
    if (result.code !== "OK") throw Error("TEST_RECOGNITION_FAILED");
    expect(result.data.suggestions).toHaveLength(86);
    expect(result.data.suggestions[0]).toMatchObject({ field: "DOCUMENT_TEXT", value: text });
    expect(result.data.suggestions.at(-1)).toMatchObject({ value: finalValue });
  });
});
