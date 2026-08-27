import "server-only";

import { resolveAuthorization } from "@/lib/server/authorization";
import { readInvoicePdf, type InvoicePdfKind } from "@/lib/server/invoiceRead";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * F1.4 — authenticated, tenant-bound download of the exact immutable original
 * or cancellation PDF bytes. No live data is recomputed on this route.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ invoiceId: string }> },
): Promise<Response> {
  const { invoiceId } = await context.params;
  if (typeof invoiceId !== "string" || !UUID_PATTERN.test(invoiceId)) {
    return Response.json({ message: "Ungültige Rechnungskennung." }, { status: 400 });
  }
  const kindValue = new URL(request.url).searchParams.get("kind") ?? "original";
  if (kindValue !== "original" && kindValue !== "cancellation") {
    return Response.json({ message: "Ungültige Belegart." }, { status: 400 });
  }
  const kind: InvoicePdfKind = kindValue;

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return Response.json({ message: "Rechnungs-PDF ist derzeit nicht verfügbar." }, { status: 503 });
  }
  if (!authorization.ok) {
    if (authorization.reason === "AUTHORIZATION_UNAVAILABLE") {
      return Response.json({ message: "Rechnungs-PDF ist derzeit nicht verfügbar." }, { status: 503 });
    }
    return Response.json({ message: "Sitzung oder Berechtigung ist nicht verfügbar." }, { status: 401 });
  }

  const result = await readInvoicePdf(authorization.data, invoiceId, kind);
  if (result.code === "FORBIDDEN") {
    return Response.json({ message: result.message }, { status: 403 });
  }
  if (result.code === "NOT_FOUND") {
    return Response.json({ message: result.message }, { status: 404 });
  }
  if (result.code === "VALIDATION_ERROR") {
    return Response.json({ message: result.message }, { status: 400 });
  }
  if (result.code === "UNAVAILABLE") {
    return Response.json({ message: result.message }, { status: 503 });
  }

  const { pdf, invoiceNumber } = result.data;
  const filename = kind === "cancellation"
    ? `${invoiceNumber}-STORNO.pdf`
    : `${invoiceNumber}.pdf`;
  // Copy into a fresh, plain ArrayBuffer so the Response body type is a
  // guaranteed BodyInit-compatible ArrayBuffer (not ArrayBufferLike), without
  // altering a single byte of the stored PDF content.
  const body: ArrayBuffer = Uint8Array.from(pdf).buffer;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
