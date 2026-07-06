import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  createClient: vi.fn(),
  fetch: vi.fn(),
  storageFrom: vi.fn(),
  storageUpload: vi.fn(),
  storageGetPublicUrl: vi.fn(),
  insert: vi.fn(),
  insertValues: vi.fn(),
  insertReturning: vi.fn(),
  update: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  select: vi.fn(),
  selectFrom: vi.fn(),
  selectWhere: vi.fn(),
  selectLimit: vi.fn(),
  extractDocumentData: vi.fn(),
  eq: vi.fn((column, value) => ({ op: "eq", column, value })),
  and: vi.fn((...conditions) => ({ op: "and", conditions })),
}));

vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: mocks.resolveAuthorization,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/db", () => ({
  db: {
    insert: mocks.insert,
    update: mocks.update,
    select: mocks.select,
  },
}));

vi.mock("@/lib/ocr/geminiOcr", () => ({
  extractDocumentData: mocks.extractDocumentData,
}));

vi.mock("drizzle-orm", () => ({
  eq: mocks.eq,
  and: mocks.and,
}));

let POST: (request: Request) => Promise<Response>;
let GET: (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;
let freetextPOST: (request: Request) => Promise<Response>;
let notesExtractPOST: (request: Request) => Promise<Response>;
let inquiryExtractPOST: (request: Request) => Promise<Response>;
let customerEnrichPOST: (request: Request) => Promise<Response>;

const authorized = (tenantId = "session-tenant") => ({
  ok: true as const,
  data: {
    userId: "user-1",
    tenantId,
    displayName: "Test User",
    role: "admin",
    permissions: [],
  },
});

const unauthorized = {
  ok: false as const,
  reason: "NO_SESSION" as const,
  message: "AUTH_ERROR: Nicht angemeldet",
};

function makeUploadRequest(file: File, tenantId?: string): Request {
  const formData = new FormData();
  formData.append("file", file);
  if (tenantId) formData.append("tenantId", tenantId);
  return {
    formData: vi.fn().mockResolvedValue(formData),
  } as unknown as Request;
}

function makeFile() {
  return new File(["scan-content"], "scan.pdf", { type: "application/pdf" });
}

function makeItemUploadRequest(
  file: File | null,
  fields: {
    tenantId?: string;
    itemId?: string;
    userId?: string;
    role?: string;
  } = {},
): Request {
  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }
  if (fields.tenantId) {
    formData.append("tenantId", fields.tenantId);
  }
  if (fields.itemId) {
    formData.append("itemId", fields.itemId);
  }
  if (fields.userId) {
    formData.append("userId", fields.userId);
  }
  if (fields.role) {
    formData.append("role", fields.role);
  }

  return {
    formData: vi.fn().mockResolvedValue(formData),
  } as unknown as Request;
}

describe("scan capture route auth", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    mocks.resolveAuthorization.mockResolvedValue(authorized());
    mocks.createClient.mockReturnValue({
      storage: {
        from: mocks.storageFrom,
      },
    });
    mocks.storageFrom.mockReturnValue({
      upload: mocks.storageUpload,
      getPublicUrl: mocks.storageGetPublicUrl,
    });
    mocks.storageUpload.mockResolvedValue({
      data: { path: "session-tenant/file.pdf" },
      error: null,
    });
    mocks.storageGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.example/session-tenant/file.pdf" },
    });
    mocks.insert.mockReturnValue({ values: mocks.insertValues });
    mocks.insertValues.mockReturnValue({ returning: mocks.insertReturning });
    mocks.insertReturning.mockResolvedValue([{ id: "scan-1" }]);
    mocks.update.mockReturnValue({ set: mocks.updateSet });
    mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
    mocks.updateWhere.mockResolvedValue(undefined);
    mocks.select.mockReturnValue({ from: mocks.selectFrom });
    mocks.selectFrom.mockReturnValue({ where: mocks.selectWhere });
    mocks.selectWhere.mockReturnValue({ limit: mocks.selectLimit });
    mocks.selectLimit.mockResolvedValue([]);
    mocks.extractDocumentData.mockResolvedValue({ customerName: "Kreile" });

    ({ POST } = await import("../scan-upload/route"));
    ({ GET } = await import("../scan-status/[id]/route"));
  });

  it("rejects unauthenticated upload before FormData, storage or DB", async () => {
    mocks.resolveAuthorization.mockResolvedValue(unauthorized);
    const formData = vi.fn();

    const response = await POST({ formData } as unknown as Request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sitzung abgelaufen oder nicht angemeldet",
    });
    expect(formData).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.storageUpload).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects missing file before storage or service-role client setup", async () => {
    const formData = new FormData(); // kein file-Feld
    const response = await POST({
      formData: vi.fn().mockResolvedValue(formData),
    } as unknown as Request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No file provided" });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.storageUpload).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns generic error when storage rejects the upload", async () => {
    mocks.storageUpload.mockResolvedValue({
      data: null,
      error: {
        message: "bucket missing",
        details: "raw storage details",
        hint: "check bucket config",
      },
    });

    const response = await POST(makeUploadRequest(makeFile()));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Failed to upload file" });
    // Rohe Storage-Details dürfen nicht in der Client-Antwort erscheinen
    expect(JSON.stringify(body)).not.toContain("bucket missing");
    expect(JSON.stringify(body)).not.toContain("raw storage details");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("ignores a forged client tenant during upload", async () => {
    mocks.resolveAuthorization.mockResolvedValue(authorized("session-tenant"));

    await POST(makeUploadRequest(makeFile(), "forged-tenant"));

    expect(mocks.storageUpload).toHaveBeenCalledTimes(1);
    expect(mocks.storageUpload.mock.calls[0][0]).toMatch(/^session-tenant\//);
    expect(mocks.storageUpload.mock.calls[0][0]).not.toContain("forged-tenant");
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "session-tenant" }),
    );
  });

  it("uses only the session tenant for a successful upload", async () => {
    mocks.resolveAuthorization.mockResolvedValue(authorized("tenant-a"));

    const response = await POST(makeUploadRequest(makeFile()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "scan-1" });
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-a" }),
    );
    expect(mocks.storageUpload.mock.calls[0][0]).toMatch(/^tenant-a\//);
  });

  it("adds the authorized tenant to scan update filters", async () => {
    mocks.resolveAuthorization.mockResolvedValue(authorized("tenant-filter"));

    await POST(makeUploadRequest(makeFile()));

    expect(mocks.updateWhere).toHaveBeenCalledWith({
      op: "and",
      conditions: expect.arrayContaining([
        expect.objectContaining({ op: "eq", value: "scan-1" }),
        expect.objectContaining({ op: "eq", value: "tenant-filter" }),
      ]),
    });
  });

  it("rejects unauthenticated status requests before DB access", async () => {
    mocks.resolveAuthorization.mockResolvedValue(unauthorized);

    const response = await GET(new Request("http://localhost/status"), {
      params: Promise.resolve({ id: "scan-1" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("returns 404 for a tenant-foreign scan id", async () => {
    mocks.resolveAuthorization.mockResolvedValue(authorized("tenant-a"));
    mocks.selectLimit.mockResolvedValue([]);

    const response = await GET(new Request("http://localhost/status"), {
      params: Promise.resolve({ id: "foreign-scan" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
    expect(mocks.selectWhere).toHaveBeenCalledWith({
      op: "and",
      conditions: expect.arrayContaining([
        expect.objectContaining({ op: "eq", value: "foreign-scan" }),
        expect.objectContaining({ op: "eq", value: "tenant-a" }),
      ]),
    });
  });

  it("returns the record for an own-tenant scan id", async () => {
    const scan = { id: "scan-1", tenantId: "tenant-a", status: "processed" };
    mocks.resolveAuthorization.mockResolvedValue(authorized("tenant-a"));
    mocks.selectLimit.mockResolvedValue([scan]);

    const response = await GET(new Request("http://localhost/status"), {
      params: Promise.resolve({ id: "scan-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(scan);
    expect(mocks.selectWhere).toHaveBeenCalledWith({
      op: "and",
      conditions: expect.arrayContaining([
        expect.objectContaining({ op: "eq", value: "scan-1" }),
        expect.objectContaining({ op: "eq", value: "tenant-a" }),
      ]),
    });
  });

});

describe("item photo upload route auth", () => {
  let itemPhotoPOST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    mocks.resolveAuthorization.mockResolvedValue(authorized());
    mocks.createClient.mockReturnValue({
      storage: {
        from: mocks.storageFrom,
      },
    });
    mocks.storageFrom.mockReturnValue({
      upload: mocks.storageUpload,
      getPublicUrl: mocks.storageGetPublicUrl,
    });
    mocks.storageUpload.mockResolvedValue({
      data: { path: "session-tenant/file.pdf" },
      error: null,
    });
    mocks.storageGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.example/session-tenant/item-123/file.pdf" },
    });
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ material: "steel" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    ({ POST: itemPhotoPOST } = await import("../item-photo-upload/route"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects unauthenticated uploads before FormData, storage or service-role setup", async () => {
    mocks.resolveAuthorization.mockResolvedValue(unauthorized);
    const formData = vi.fn();

    const response = await itemPhotoPOST({ formData } as unknown as Request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sitzung abgelaufen oder nicht angemeldet",
    });
    expect(formData).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.storageUpload).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects invalid uploads before storage or service-role use", async () => {
    const response = await itemPhotoPOST(
      makeItemUploadRequest(null, {
        tenantId: "forged-tenant",
        userId: "attacker",
        role: "admin",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No file provided" });
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.storageUpload).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("uses the session tenant and ignores forged client tenant fields", async () => {
    mocks.resolveAuthorization.mockResolvedValue(authorized("session-tenant"));

    const response = await itemPhotoPOST(
      makeItemUploadRequest(makeFile(), {
        tenantId: "forged-tenant",
        itemId: "item-123",
        userId: "attacker",
        role: "admin",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://storage.example/session-tenant/item-123/file.pdf",
      analysis: { material: "steel" },
    });
    expect(mocks.storageUpload).toHaveBeenCalledTimes(1);
    expect(mocks.storageUpload.mock.calls[0][0]).toMatch(/^session-tenant\/item-123\//);
    expect(mocks.storageUpload.mock.calls[0][0]).not.toContain("forged-tenant");
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://supabase.example/functions/v1/item-photo-analyze",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer service-role-key",
        },
        body: JSON.stringify({
          file_url: "https://storage.example/session-tenant/item-123/file.pdf",
          mime_type: "application/pdf",
        }),
      },
    );
  });

  it("returns a generic error when storage rejects the upload", async () => {
    mocks.storageUpload.mockResolvedValue({
      data: null,
      error: {
        message: "bucket missing",
        details: "raw storage details",
        hint: "check bucket",
      },
    });

    const response = await itemPhotoPOST(
      makeItemUploadRequest(makeFile(), {
        tenantId: "session-tenant",
        itemId: "item-123",
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to upload item photo",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});

describe("freetext extract route auth", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    mocks.resolveAuthorization.mockResolvedValue(authorized());
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ extracted: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    ({ POST: freetextPOST } = await import("../freetext-extract/route"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects unauthenticated freetext extraction before JSON parsing", async () => {
    mocks.resolveAuthorization.mockResolvedValue(unauthorized);
    const json = vi.fn();

    const response = await freetextPOST({ json } as unknown as Request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sitzung abgelaufen oder nicht angemeldet",
    });
    expect(json).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects invalid freetext payloads before forwarding", async () => {
    const response = await freetextPOST({
      json: vi.fn().mockResolvedValue({ text: " x ", extra: true }),
    } as unknown as Request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Ungültige Anfrage",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("forwards only trimmed text plus the session tenant", async () => {
    mocks.resolveAuthorization.mockResolvedValue(authorized("tenant-freetext"));

    const response = await freetextPOST({
      json: vi.fn().mockResolvedValue({ text: "  Anfrage Text  " }),
    } as unknown as Request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ extracted: "ok" });
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://supabase.example/functions/v1/freetext-extract",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer service-role-key",
        },
        body: JSON.stringify({
          text: "Anfrage Text",
          tenantId: "tenant-freetext",
        }),
      },
    );
  });

  it("preserves the edge status while hiding edge failure details", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "debug details" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await freetextPOST({
      json: vi.fn().mockResolvedValue({ text: "Valider Text" }),
    } as unknown as Request);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Verarbeitung fehlgeschlagen",
    });
  });
});

describe("notes extract route auth", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    mocks.resolveAuthorization.mockResolvedValue(authorized());
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ extracted: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    ({ POST: notesExtractPOST } = await import("../notes-extract/route"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects unauthenticated notes extraction before JSON parsing", async () => {
    mocks.resolveAuthorization.mockResolvedValue(unauthorized);
    const json = vi.fn();

    const response = await notesExtractPOST({ json } as unknown as Request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sitzung abgelaufen oder nicht angemeldet",
    });
    expect(json).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects invalid notes payloads before forwarding", async () => {
    const response = await notesExtractPOST({
      json: vi.fn().mockResolvedValue({ notes: " x ", extra: true }),
    } as unknown as Request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Ungültige Anfrage",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("forwards only trimmed notes plus the session tenant", async () => {
    mocks.resolveAuthorization.mockResolvedValue(authorized("tenant-notes"));

    const response = await notesExtractPOST({
      json: vi.fn().mockResolvedValue({ notes: "  Wichtige Notiz  " }),
    } as unknown as Request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ extracted: "ok" });
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://supabase.example/functions/v1/notes-extract",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer service-role-key",
        },
        body: JSON.stringify({
          notes: "Wichtige Notiz",
          tenantId: "tenant-notes",
        }),
      },
    );
  });

  it("preserves the edge status while hiding edge failure details", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "debug details" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const response = await notesExtractPOST({
      json: vi.fn().mockResolvedValue({ notes: "Valide Notiz" }),
    } as unknown as Request);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Verarbeitung fehlgeschlagen",
    });
  });
});

describe("inquiry extract route auth", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    mocks.resolveAuthorization.mockResolvedValue(authorized());
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ extracted: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    ({ POST: inquiryExtractPOST } = await import("../inquiry-extract/route"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects unauthenticated inquiry extraction before JSON parsing", async () => {
    mocks.resolveAuthorization.mockResolvedValue(unauthorized);
    const json = vi.fn();

    const response = await inquiryExtractPOST({ json } as unknown as Request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sitzung abgelaufen oder nicht angemeldet",
    });
    expect(json).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects invalid inquiry payloads before forwarding", async () => {
    const response = await inquiryExtractPOST({
      json: vi.fn().mockResolvedValue({ text: " " }),
    } as unknown as Request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Ungültige Anfrage",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("forwards only trimmed text plus the session tenant", async () => {
    mocks.resolveAuthorization.mockResolvedValue(authorized("tenant-inquiry"));

    const response = await inquiryExtractPOST({
      json: vi.fn().mockResolvedValue({
        text: "  Anfrage zu Chromteilen  ",
        tenantId: "attacker-tenant",
        role: "admin",
        extra: "must-not-forward",
      }),
    } as unknown as Request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ extracted: "ok" });
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://supabase.example/functions/v1/inquiry-extract",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer service-role-key",
        },
        body: JSON.stringify({
          text: "Anfrage zu Chromteilen",
          tenantId: "tenant-inquiry",
        }),
      },
    );
  });

  it("preserves the edge status while hiding edge failure details", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "debug details",
          stack: "stack trace",
          provider: "internal provider",
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const response = await inquiryExtractPOST({
      json: vi.fn().mockResolvedValue({ text: "Valide Anfrage" }),
    } as unknown as Request);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Verarbeitung fehlgeschlagen",
    });
  });
});

describe("customer enrich route auth", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    mocks.resolveAuthorization.mockResolvedValue(authorized());
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ enriched: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    ({ POST: customerEnrichPOST } = await import("../customer-enrich/route"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects unauthenticated customer enrichment before JSON parsing", async () => {
    mocks.resolveAuthorization.mockResolvedValue(unauthorized);
    const json = vi.fn();

    const response = await customerEnrichPOST({ json } as unknown as Request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sitzung abgelaufen oder nicht angemeldet",
    });
    expect(json).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects invalid customer enrichment payloads before forwarding", async () => {
    const response = await customerEnrichPOST({
      json: vi.fn().mockResolvedValue({ company: "Kreile", city: "Fulda", extra: true }),
    } as unknown as Request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Ungültige Anfrage",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("forwards only validated fields plus the session tenant", async () => {
    mocks.resolveAuthorization.mockResolvedValue(authorized("tenant-enrich"));

    const response = await customerEnrichPOST({
      json: vi.fn().mockResolvedValue({
        company: "  Kreile GmbH  ",
        city: "  Fulda  ",
      }),
    } as unknown as Request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enriched: "ok" });
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://supabase.example/functions/v1/customer-enrich",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer service-role-key",
        },
        body: JSON.stringify({
          company: "Kreile GmbH",
          city: "Fulda",
          tenantId: "tenant-enrich",
        }),
      },
    );
  });

  it("preserves the edge status while hiding edge failure details", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "debug details",
          stack: "stack trace",
          provider: "internal provider",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const response = await customerEnrichPOST({
      json: vi.fn().mockResolvedValue({ company: "Kreile GmbH", city: "Fulda" }),
    } as unknown as Request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Verarbeitung fehlgeschlagen",
    });
  });
});
