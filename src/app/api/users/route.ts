import { NextResponse } from "next/server";
import { guardMockApi } from "@/lib/server/mockApiGuard";

export async function GET() {
  const blocked = await guardMockApi();
  if (blocked) return blocked;
  const users = [
    { id: "1", name: "Meister Kreile", initials: "MK", active: true },
    { id: "2", name: "Chef-Stellvertreter", initials: "CD", active: true },
    { id: "3", name: "Büro / Rechnung", initials: "RS", active: true }
  ];
  return NextResponse.json(users);
}
