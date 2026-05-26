import { NextResponse } from "next/server";

export async function GET() {
  const users = [
    { id: "1", name: "Meister Kreile", initials: "MK", active: true },
    { id: "2", name: "Chef-Stellvertreter", initials: "CD", active: true },
    { id: "3", name: "Büro / Rechnung", initials: "RS", active: true }
  ];
  return NextResponse.json(users);
}
