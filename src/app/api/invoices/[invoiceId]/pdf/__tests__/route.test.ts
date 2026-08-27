import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveAuthorization, readInvoicePdf } = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  readInvoicePdf: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization }));
vi.mock("@/lib/server/invoiceRead", () => ({ readInvoicePdf }));

const VALID_ID = "11111111-1111-4111-8111-111111111111";
const authorization = {
  ok: true as const,
  data: { tenantId: "galvanik-kreile", userId: "22222222-2222-4222-8222-222222222222", role: "buero" as const },
};

function context(invoiceId: string) {
  return { params: Promise.resolve({ invoiceId }) };
}

describe("GET /api/invoices/[invoiceId]/pdf", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 400 for a malformed invoice id before touching auth or the read port", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://local/x"), context("not-a-uuid"));
    expect(response.status).toBe(400);
    expect(resolveAuthorization).not.toHaveBeenCalled();
    expect(readInvoicePdf).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown document kind before touching auth", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request(`http://local/x?kind=preview`), context(VALID_ID));
    expect(response.status).toBe(400);
    expect(resolveAuthorization).not.toHaveBeenCalled();
    expect(readInvoicePdf).not.toHaveBeenCalled();
  });

  it("returns 503 when authorization resolution throws or is unavailable, never a PDF", async () => {
    resolveAuthorization.mockRejectedValueOnce(new Error("boom"));
    const { GET } = await import("../route");
    let response = await GET(new Request("http://local/x"), context(VALID_ID));
    expect(response.status).toBe(503);
    expect(readInvoicePdf).not.toHaveBeenCalled();

    resolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "AUTHORIZATION_UNAVAILABLE", message: "n/a" });
    response = await GET(new Request("http://local/x"), context(VALID_ID));
    expect(response.status).toBe(503);
    expect(readInvoicePdf).not.toHaveBeenCalled();
  });

  it("returns 401 for a missing session/no authorization", async () => {
    resolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "NO_SESSION", message: "no" });
    const { GET } = await import("../route");
    const response = await GET(new Request("http://local/x"), context(VALID_ID));
    expect(response.status).toBe(401);
    expect(readInvoicePdf).not.toHaveBeenCalled();
  });

  it("maps read-port FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, and UNAVAILABLE to their exact status codes", async () => {
    resolveAuthorization.mockResolvedValue(authorization);
    const { GET } = await import("../route");

    readInvoicePdf.mockResolvedValueOnce({ code: "FORBIDDEN", message: "no" });
    expect((await GET(new Request("http://local/x"), context(VALID_ID))).status).toBe(403);

    readInvoicePdf.mockResolvedValueOnce({ code: "NOT_FOUND", message: "no" });
    expect((await GET(new Request("http://local/x"), context(VALID_ID))).status).toBe(404);

    readInvoicePdf.mockResolvedValueOnce({ code: "VALIDATION_ERROR", message: "no" });
    expect((await GET(new Request("http://local/x"), context(VALID_ID))).status).toBe(400);

    readInvoicePdf.mockResolvedValueOnce({ code: "UNAVAILABLE", message: "no" });
    expect((await GET(new Request("http://local/x"), context(VALID_ID))).status).toBe(503);
  });

  it("returns 200 with the identical stored bytes, correct PDF headers, no-store caching and attachment disposition", async () => {
    resolveAuthorization.mockResolvedValue(authorization);
    const storedBytes = Buffer.from([37, 80, 68, 70, 1, 2, 3, 255]);
    readInvoicePdf.mockResolvedValueOnce({
      code: "OK",
      data: { pdf: storedBytes, invoiceNumber: "R-2026-0009", pdfSha256: "c".repeat(64), kind: "original" },
    });
    const { GET } = await import("../route");
    const response = await GET(new Request("http://local/x"), context(VALID_ID));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="R-2026-0009.pdf"');
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Length")).toBe(String(storedBytes.byteLength));

    const returnedBytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(returnedBytes)).toEqual(Array.from(storedBytes));
    expect(readInvoicePdf).toHaveBeenCalledWith(authorization.data, VALID_ID, "original");
  });

  it("returns the exact stored cancellation bytes with an explicit filename", async () => {
    resolveAuthorization.mockResolvedValue(authorization);
    const storedBytes = Buffer.from([37, 80, 68, 70, 9, 9, 9]);
    readInvoicePdf.mockResolvedValueOnce({
      code: "OK",
      data: { pdf: storedBytes, invoiceNumber: "R-2026-0009", pdfSha256: "d".repeat(64), kind: "cancellation" },
    });
    const { GET } = await import("../route");
    const response = await GET(
      new Request("http://local/x?kind=cancellation"),
      context(VALID_ID),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="R-2026-0009-STORNO.pdf"');
    expect(readInvoicePdf).toHaveBeenCalledWith(authorization.data, VALID_ID, "cancellation");
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual(Array.from(storedBytes));
  });
});
