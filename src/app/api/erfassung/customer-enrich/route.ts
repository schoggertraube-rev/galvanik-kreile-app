import { NextResponse } from "next/server";
import { resolveAuthorization } from "@/lib/server/authorization";

type CustomerEnrichPayload = {
  company: string;
  city: string;
};

function validatePayload(payload: unknown): CustomerEnrichPayload | null {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  if (keys.length === 0 || keys.length > 2) {
    return null;
  }

  if (!keys.every((key) => key === "city" || key === "company")) {
    return null;
  }

  const companyValue = candidate.company;
  const cityValue = candidate.city;

  if (companyValue !== undefined && typeof companyValue !== "string") {
    return null;
  }

  if (cityValue !== undefined && typeof cityValue !== "string") {
    return null;
  }

  const company = typeof companyValue === "string" ? companyValue.trim() : "";
  const city = typeof cityValue === "string" ? cityValue.trim() : "";

  if (!company && !city) {
    return null;
  }

  if (company.length > 200 || city.length > 120) {
    return null;
  }

  return { company, city };
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
      console.error("Customer enrich proxy misconfigured:", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });
      return NextResponse.json({ error: "Service nicht verfügbar" }, { status: 500 });
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/customer-enrich`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        company: payload.company,
        city: payload.city,
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
      console.error("Customer enrich proxy error:", error.message);
    } else {
      console.error("Customer enrich proxy error:", error);
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
