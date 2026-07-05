import { NextResponse } from "next/server";
import { resolveAuthorization } from "@/lib/server/authorization";

type InquiryExtractPayload = {
  text: string;
};

function validatePayload(payload: unknown): InquiryExtractPayload | null {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const text = candidate.text;
  if (typeof text !== "string") {
    return null;
  }

  const trimmedText = text.trim();
  if (trimmedText.length < 2 || trimmedText.length > 8000) {
    return null;
  }

  return { text: trimmedText };
}

export async function POST(request: Request) {
  try {
    const auth = await resolveAuthorization();
    if (!auth.ok) {
      return NextResponse.json(
        { error: "Sitzung abgelaufen oder nicht angemeldet" },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
    }

    const payload = validatePayload(body);
    if (!payload) {
      return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Inquiry extract proxy misconfigured:", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });
      return NextResponse.json({ error: "Service nicht verfügbar" }, { status: 500 });
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/inquiry-extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        text: payload.text,
        tenantId: auth.data.tenantId,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Verarbeitung fehlgeschlagen" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof Error) {
      console.error("Inquiry extract proxy error:", error.message);
    } else {
      console.error("Inquiry extract proxy error:", error);
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
