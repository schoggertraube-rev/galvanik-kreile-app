import { NextResponse } from "next/server";

export async function GET() {
  // Logic to compute today's work state: Gut auf Kurs / Aufpassen / Kritisch
  return NextResponse.json({
    status: "success",
    title: "Gut auf Kurs",
    subtitle: "Weiter so! 💪"
  });
}
