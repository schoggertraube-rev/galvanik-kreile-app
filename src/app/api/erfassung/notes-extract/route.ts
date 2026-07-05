import { NextResponse } from "next/server";
import { resolveAuthorization } from "@/lib/server/authorization";

type NotesExtractPayload = {
  notes: string;
};

function validatePayload(payload: unknown): NotesExtractPayload | null {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const keys = Object.keys(candidate);
  if (keys.length !== 1 || keys[0] !== "notes") {
    return null;
  }

  const notes = candidate.notes;
  if (typeof notes !== "string") {
    return null;
  }

  const trimmedNotes = notes.trim();
  if (trimmedNotes.length < 2 || trimmedNotes.length > 8000) {
    return null;
  }

  return { notes: trimmedNotes };
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
      console.error("Notes extract proxy misconfigured:", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });
      return NextResponse.json({ error: "Service nicht verfügbar" }, { status: 500 });
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/notes-extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        notes: payload.notes,
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
      console.error("Notes extract proxy error:", error.message);
    } else {
      console.error("Notes extract proxy error:", error);
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
