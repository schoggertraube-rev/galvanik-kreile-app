import { beforeEach, describe, expect, it, vi } from "vitest";

const { readQuotePdfAction } = vi.hoisted(() => ({ readQuotePdfAction: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/app/actions/quotes.actions", () => ({ readQuotePdfAction }));

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";

function context(documentId: string) {
  return { params: Promise.resolve({ documentId }) };
}

describe("GET /api/documents/[documentId]/quote-pdf", () => {
  beforeEach(() => vi.resetAllMocks());

  it("rejects malformed ids before the authenticated action", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://local/x"), context("invalid"));
    expect(response.status).toBe(400);
    expect(readQuotePdfAction).not.toHaveBeenCalled();
  });

  it("maps authenticated read failures without returning a PDF", async () => {
    readQuotePdfAction.mockResolvedValueOnce({ code: "UNAUTHENTICATED", message: "Keine Sitzung." });
    const { GET } = await import("../route");
    expect((await GET(new Request("http://local/x"), context(DOCUMENT_ID))).status).toBe(401);

    readQuotePdfAction.mockResolvedValueOnce({ code: "NOT_FOUND", message: "Nicht gefunden." });
    expect((await GET(new Request("http://local/x"), context(DOCUMENT_ID))).status).toBe(404);
  });

  it("returns the rendered bytes with private PDF headers", async () => {
    const bytes = Buffer.from("%PDF-test");
    readQuotePdfAction.mockResolvedValueOnce({ code: "OK", pdf: bytes, quoteNumber: "KV-2026-0042" });
    const { GET } = await import("../route");
    const response = await GET(new Request("http://local/x"), context(DOCUMENT_ID));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="KV-2026-0042.pdf"');
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(readQuotePdfAction).toHaveBeenCalledWith({ quoteId: DOCUMENT_ID });
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual(Array.from(bytes));
  });
});
