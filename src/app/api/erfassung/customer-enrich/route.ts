import { NextResponse } from "next/server";
import { resolveAuthorization } from "@/lib/server/authorization";
import { parseCustomerEnrichInput, parseCustomerEnrichmentResult } from "@/lib/server/aiInputs";
import { proxyMeteredAiRequest } from "@/lib/server/aiUsage";

export async function POST(request: Request) {
  const auth = await resolveAuthorization();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    auth.data.tenantId !== "galvanik-kreile" ||
    !auth.data.permissions.includes("perm_data_customers")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload;
  try {
    payload = parseCustomerEnrichInput(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  return proxyMeteredAiRequest({
    request,
    identity: auth.data,
    feature: "customer-enrich",
    payload,
    maxOutputTokens: 512,
    parseResult: parseCustomerEnrichmentResult,
  });
}
