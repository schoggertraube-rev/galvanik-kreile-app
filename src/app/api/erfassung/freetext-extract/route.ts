import { NextResponse } from "next/server";
import { resolveAuthorization } from "@/lib/server/authorization";
import { parseCustomerFreetextResult, parseFreetextInput } from "@/lib/server/aiInputs";
import { proxyMeteredAiRequest } from "@/lib/server/aiUsage";

export async function POST(request: Request) {
  const auth = await resolveAuthorization();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    auth.data.tenantId !== "galvanik-kreile" ||
    !auth.data.permissions.includes("perm_data_orders")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload;
  try {
    payload = parseFreetextInput(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  return proxyMeteredAiRequest({
    request,
    identity: auth.data,
    feature: "freetext-extract",
    payload,
    maxOutputTokens: 1_024,
    parseResult: parseCustomerFreetextResult,
  });
}
