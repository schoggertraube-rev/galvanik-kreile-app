import { NextResponse } from "next/server";
import { guardMockApi } from "@/lib/server/mockApiGuard";

export async function GET() {
  const blocked = await guardMockApi();
  if (blocked) return blocked;
  const alerts = [
    { icon: "alert-triangle", title: "Salzsäure fast leer", subtitle: "Bestellung nicht vergessen.", href: "/items", color: "warning" },
    { icon: "info", title: "2 Freigaben fehlen", subtitle: "Kunden warten auf Rückmeldung.", href: "/customers", color: "info" },
    { icon: "check-circle", title: "Warenausgang im Plan", subtitle: "Heute 4 Abholungen geplant.", href: "/orders", color: "success" }
  ];
  return NextResponse.json(alerts);
}
