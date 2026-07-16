import { NextResponse } from "next/server";
import { resolveAuthorization } from "@/lib/server/authorization";

export async function guardMockApi(): Promise<NextResponse | null> {
  const auth = await resolveAuthorization();
  if (process.env.NODE_ENV === "production" || process.env.KREILE_MOCK_API !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
