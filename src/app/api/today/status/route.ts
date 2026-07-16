import { NextResponse } from "next/server";
import { guardMockApi } from "@/lib/server/mockApiGuard";

export async function GET() {
  const blocked = await guardMockApi();
  if (blocked) return blocked;
  // Logic to compute today's work state: Gut auf Kurs / Aufpassen / Kritisch
  return NextResponse.json({
    status: "success",
    title: "Gut auf Kurs",
    subtitle: "Weiter so! 💪"
  });
}
