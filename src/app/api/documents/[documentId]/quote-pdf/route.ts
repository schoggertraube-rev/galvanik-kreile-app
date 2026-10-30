import "server-only";

import { readQuotePdfAction } from "@/app/actions/quotes.actions";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
): Promise<Response> {
  const { documentId } = await context.params;
  if (!UUID_PATTERN.test(documentId)) {
    return Response.json({ message: "Ungültige KV-Kennung." }, { status: 400 });
  }

  const result = await readQuotePdfAction({ quoteId: documentId });
  if (result.code !== "OK") {
    const status = result.code === "FORBIDDEN" ? 403
      : result.code === "UNAUTHENTICATED" ? 401
        : result.code === "NOT_FOUND" ? 404
          : result.code === "VALIDATION_ERROR" ? 400
            : 503;
    return Response.json({ message: result.message }, { status });
  }

  const body: ArrayBuffer = Uint8Array.from(result.pdf).buffer;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.quoteNumber}.pdf"`,
      "Content-Length": String(result.pdf.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
