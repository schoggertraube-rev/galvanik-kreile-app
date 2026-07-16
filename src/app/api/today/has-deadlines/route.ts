import { NextResponse } from "next/server";
import { guardMockApi } from "@/lib/server/mockApiGuard";

export async function GET() {
  const blocked = await guardMockApi();
  if (blocked) return blocked;
  return NextResponse.json({ hasDeadlines: true });
}
