import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockResolveAuthorization,
  mockExtract,
  mockDbSelect,
  mockDbTransaction,
  mockTxInsert,
  mockCreateSupabaseClient,
  mockStorageFrom,
  mockStorageUpload,
  mockCreateSignedUrl,
  mockReserveUsage,
  mockClaimUsage,
  mockSettleUsage,
  receiptTable,
  auditTable,
} = vi.hoisted(() => ({
  mockResolveAuthorization: vi.fn(),
  mockExtract: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbTransaction: vi.fn(),
  mockTxInsert: vi.fn(),
  mockCreateSupabaseClient: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockStorageUpload: vi.fn(),
  mockCreateSignedUrl: vi.fn(),
  mockReserveUsage: vi.fn(),
  mockClaimUsage: vi.fn(),
  mockSettleUsage: vi.fn(),
  receiptTable: { id: "beleg.id" },
  auditTable: { id: "audit.id" },
}));

vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: mockResolveAuthorization }));
vi.mock("@/lib/server/aiUsage", () => ({
  reserveDirectAiUsage: mockReserveUsage,
  claimDirectAiUsage: mockClaimUsage,
  settleDirectAiUsage: mockSettleUsage,
}));
vi.mock("@/db", () => ({ db: { select: mockDbSelect, transaction: mockDbTransaction } }));
vi.mock("@/db/schema_buchhaltung", () => ({
  beleg: receiptTable,
  bhAuditLog: auditTable,
  lieferant: { id: "supplier.id", nameNormalisiert: "supplier.normalized", standardKategorieId: "supplier.category" },
}));
vi.mock("drizzle-orm", () => ({ eq: vi.fn((left, right) => ({ left, right })) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mockCreateSupabaseClient }));
vi.mock("@/lib/ocr/KlippaProvider", () => ({
  KlippaProvider: class { extractBeleg = mockExtract; },
}));
vi.mock("@/lib/ocr/GeminiProvider", () => ({
  GeminiProvider: class { extractBeleg = mockExtract; },
}));

import { POST } from "@/app/api/ocr-process/route";

const reservationId = "123e4567-e89b-42d3-a456-426614174000";
const admin = {
  userId: "123e4567-e89b-42d3-a456-426614174001",
  tenantId: "galvanik-kreile",
  displayName: "Admin",
  role: "admin",
  permissions: ["perm_view_prices"],
  active: true,
};
const ocrResult = {
  lieferant: "Lieferant GmbH",
  datum: "2026-07-15",
  brutto: 119,
  netto: 100,
  ustSatz: 19,
  ustBetrag: 19,
  belegart: "rechnung",
  zahlungsart: "karte",
  rechnungsnummer: "R-42",
  confidence: 0.5,
  rohtext: "Lieferant GmbH Rechnung 119 EUR",
  positionen: [],
  actualUnits: 321,
  providerStatus: "gemini-test",
};

function receiptRequest(
  bytes: Uint8Array = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]),
  type = "image/jpeg",
  name = "receipt.jpg",
) {
  const body = new FormData();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  body.set("file", new File([buffer], name, { type }));
  return { formData: vi.fn(async () => body) } as unknown as Request;
}

describe("OCR receipt draft boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPABASE_URL", "https://tenant.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
    vi.stubEnv("GEMINI_API_KEY", "gemini-test-key");
    vi.stubEnv("KLIPPA_API_KEY", "");
    mockResolveAuthorization.mockResolvedValue({ ok: true, data: admin });
    mockCreateSupabaseClient.mockReturnValue({ storage: { from: mockStorageFrom } });
    mockStorageFrom.mockReturnValue({ upload: mockStorageUpload, createSignedUrl: mockCreateSignedUrl });
    mockStorageUpload.mockResolvedValue({ data: { path: "stored" }, error: null });
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: "https://tenant.supabase.co/signed/receipt" }, error: null });
    mockReserveUsage.mockResolvedValue({ kind: "reserved", reservationId });
    mockClaimUsage.mockResolvedValue(undefined);
    mockSettleUsage.mockResolvedValue(undefined);
    mockExtract.mockResolvedValue(ocrResult);
    mockDbSelect.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ id: "supplier-1", standardKategorieId: "category-1" }]),
        })),
      })),
    }));
    mockTxInsert.mockImplementation((table) => ({
      values: vi.fn((values) => ({
        returning: vi.fn(async () => table === receiptTable
          ? [{ id: "receipt-1", values }]
          : [{ id: "audit-1", values }]),
      })),
    }));
    mockDbTransaction.mockImplementation(async (callback) => callback({ insert: mockTxInsert }));
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects missing sessions before parsing a body or touching providers", async () => {
    mockResolveAuthorization.mockResolvedValue({ ok: false, reason: "NO_SESSION" });
    const request = new Request("http://localhost/api/ocr-process", { method: "POST", body: "invalid" });
    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(mockReserveUsage).not.toHaveBeenCalled();
    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it("rejects readonly users and forged file signatures before storage or metering", async () => {
    mockResolveAuthorization.mockResolvedValueOnce({ ok: true, data: { ...admin, role: "readonly", permissions: [] } });
    expect((await POST(receiptRequest())).status).toBe(403);
    mockResolveAuthorization.mockResolvedValueOnce({ ok: true, data: admin });
    expect((await POST(receiptRequest(new Uint8Array([1, 2, 3, 4])))).status).toBe(415);
    expect(mockReserveUsage).not.toHaveBeenCalled();
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("stops before upload when no provider is configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const response = await POST(receiptRequest());
    expect(response.status).toBe(503);
    expect(mockReserveUsage).not.toHaveBeenCalled();
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("enforces Gemini usage admission before uploading", async () => {
    mockReserveUsage.mockResolvedValue({ kind: "rejected", retryAfterSeconds: 90 });
    const response = await POST(receiptRequest());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("90");
    expect(mockStorageUpload).not.toHaveBeenCalled();
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it("creates only an audited review draft after metered extraction", async () => {
    const response = await POST(receiptRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      belegId: "receipt-1",
      status: "pruefen",
      requiresReview: true,
      confidence: 0.5,
      auditId: "audit-1",
    });
    expect(mockReserveUsage).toHaveBeenCalledWith(expect.objectContaining({ feature: "receipt-ocr" }));
    expect(mockClaimUsage).toHaveBeenCalledWith(expect.objectContaining({ reservationId, feature: "receipt-ocr" }));
    expect(mockSettleUsage).toHaveBeenCalledWith(expect.objectContaining({ outcome: "succeeded", actualUnits: 321 }));
    expect(mockTxInsert).toHaveBeenCalledTimes(2);
    const receiptValues = mockTxInsert.mock.results[0].value.values.mock.calls[0][0];
    expect(receiptValues).toMatchObject({
      status: "pruefen",
      vorsteuerAbzug: false,
      absetzbarProzent: "0",
      lieferantId: "supplier-1",
      kategorieId: "category-1",
      ocrProvider: "gemini",
      ocrConfidence: "0.5",
      ocrConfidenceScale: "percent",
    });
    expect(mockStorageUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^galvanik-kreile\/123e4567-e89b-42d3-a456-426614174001\/[0-9a-f-]+\.jpg$/),
      expect.any(Uint8Array),
      { contentType: "image/jpeg", upsert: false },
    );
  });

  it("settles an uncertain Gemini attempt and creates no draft when extraction fails", async () => {
    mockExtract.mockRejectedValue(new Error("provider unavailable"));
    const response = await POST(receiptRequest());
    expect(response.status).toBe(500);
    expect(mockSettleUsage).toHaveBeenCalledWith(expect.objectContaining({ outcome: "uncertain" }));
    expect(mockDbTransaction).not.toHaveBeenCalled();
  });

  it("stops before provider and database access when private storage is unavailable", async () => {
    mockStorageUpload.mockResolvedValue({ data: null, error: { message: "bucket missing" } });
    const response = await POST(receiptRequest());
    expect(response.status).toBe(500);
    expect(mockExtract).not.toHaveBeenCalled();
    expect(mockDbTransaction).not.toHaveBeenCalled();
  });
});
