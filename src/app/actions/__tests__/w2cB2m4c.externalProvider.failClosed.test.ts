import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

const extractZeitraum = vi.fn();
const buildDataContext = vi.fn();
const generateAiResponse = vi.fn();
const generateGeminiContentWithFallback = vi.fn();
const geminiOcr = vi.fn();
const simulateScan = vi.fn();
const checkAppAuth = vi.fn();
const GoogleGenerativeAI = vi.fn();
const fetchSpy = vi.fn();

vi.mock("@/lib/search/aiAggregation", () => ({ extractZeitraum, buildDataContext }));
vi.mock("@/lib/ai/geminiClient", () => ({ generateAiResponse, generateGeminiContentWithFallback }));
vi.mock("@/lib/ocr/geminiOcr", () => ({ extractDocumentData: geminiOcr }));
vi.mock("@/lib/services/ocrService", () => ({ ocrService: { simulateScan } }));
vi.mock("@/lib/server/authHelper", () => ({ checkAppAuth }));
vi.mock("@google/generative-ai", () => ({ GoogleGenerativeAI }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema", () => ({ appUsers: {}, uiEventsTable: {} }));
vi.mock("drizzle-orm", () => ({ and: vi.fn(), eq: vi.fn(), gte: vi.fn(), ne: vi.fn(), sql: vi.fn() }));
vi.mock("@/lib/server/appSession", () => ({ APP_TENANT_ID: KREILE_TENANT_SLUG }));
vi.mock("@/lib/server/pinLoginHandle", () => ({ isValidPinLoginHandle: vi.fn(), resolvePinLoginCandidate: vi.fn() }));

const denial = "NOT_AVAILABLE: Sicherer W3-KI-/Provider-Vertrag fehlt.";

describe("W2C-B2M4C external provider fail-closed", () => {
  it("denies every server provider path before a side effect", async () => {
    vi.stubGlobal("fetch", fetchSpy);
    const [{ askGlobalAiAction }, { analyzePhoneNoteWithAI }, { processImage, processImageWithAI }, { extractCustomerDataFromFreetext, enrichCustomerData }, { getFeierabendEvents }] = await Promise.all([
      import("@/app/actions/aiSearch"),
      import("@/app/actions/analyzePhoneNote"),
      import("@/app/actions/ocr.actions"),
      import("@/app/actions/ai-enrichment.actions"),
      import("@/app/actions/start.actions"),
    ]);

    await expect(askGlobalAiAction("wie ist die Lage?")).resolves.toEqual({ zusammenfassung: denial, kernzahlen: [], auffaelligkeiten: [], empfehlungen: [] });
    await expect(analyzePhoneNoteWithAI({ text: "Bitte zurückrufen", knownFacts: { customerCandidates: [], orderCandidates: [], selectedCustomer: null, selectedOrders: [], detectedDate: null, paymentKnown: null } })).resolves.toBeNull();
    await expect(processImage("image")).rejects.toThrow(denial);
    await expect(processImageWithAI("image")).rejects.toThrow(denial);
    await expect(extractCustomerDataFromFreetext("Max Mustermann")).resolves.toEqual({ ok: false, error: denial });
    await expect(enrichCustomerData("Mustermann", "Frankfurt")).resolves.toEqual({ ok: false, error: denial });
    await expect(getFeierabendEvents()).resolves.toEqual({ event: null, success: false });

    for (const spy of [extractZeitraum, buildDataContext, generateAiResponse, generateGeminiContentWithFallback, geminiOcr, simulateScan, checkAppAuth, GoogleGenerativeAI, fetchSpy]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("keeps callers local and manual", async () => {
    const [globalSearch, customerWizard, startScreen] = await Promise.all([
      readFile("src/components/layout/GlobalSearch.tsx", "utf8"),
      readFile("src/components/erfassung/ManualFlow/CustomerWizard.tsx", "utf8"),
      readFile("src/components/start/StartScreenClient.tsx", "utf8"),
    ]);

    expect(globalSearch).not.toContain("GlobalSearchAIResult");
    expect(globalSearch).not.toContain("askGlobalAiAction");
    expect(globalSearch).toContain("FoundationUnavailable");
    expect(globalSearch).not.toContain("globalSearch");
    expect(globalSearch).not.toContain("useGlobalSearch");
    expect(customerWizard).not.toContain("ai-enrichment.actions");
    expect(customerWizard).not.toContain("handleExtractFreetext");
    expect(customerWizard).not.toContain("handleEnrichWeb");
    expect(customerWizard).not.toContain("extractCustomerDataFromFreetext");
    expect(customerWizard).not.toContain("enrichCustomerData");
    expect(customerWizard).not.toContain("Daten aus Freitext erkannt");
    expect(customerWizard).not.toContain("Daten per Web/Gemini ergänzt");
    expect(customerWizard).toContain("disabled");
    expect(customerWizard).toContain("NOT_AVAILABLE");
    expect(customerWizard).not.toContain("createCustomerDb");
    expect(startScreen).not.toContain("getFeierabendEvents");
    expect(startScreen).not.toContain("fetch(");
    expect(startScreen).not.toContain("Open-Meteo");
    expect(startScreen).not.toContain("initializeDemoIfNeeded");
    expect(startScreen).not.toContain("localStorage");
    expect(startScreen).not.toContain("20°C");
    expect(startScreen).not.toContain("Wetter in Frankfurt");
    expect(startScreen).not.toContain("Feierabend-Tipp");
    expect(startScreen).not.toContain("frankfurt-tipp");
    expect(startScreen).toContain("loginWithPin");
    expect(startScreen).toContain("notifyAdminPinReset");
    expect(startScreen).toContain("Anfrage wurde verarbeitet. Falls das Konto vorhanden ist, wird sie intern weitergeleitet.");
  });
});
