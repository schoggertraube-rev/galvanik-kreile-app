import { NextResponse } from "next/server";
import { guardMockApi } from "@/lib/server/mockApiGuard";

export async function GET() {
  const blocked = await guardMockApi();
  if (blocked) return blocked;
  const timeline = [
    { time: "08:00", title: "Wareneingang geprüft", description: "Alle Eingänge erfasst.", status: "done" },
    { time: "09:15", title: "3 Teile in Galvanik gestartet", description: "Sie laufen planmäßig.", status: "done" },
    { time: "11:30", title: "Anfragen sortieren", description: "7 Anfragen warten auf Rückmeldung.", status: "current", actionLabel: "Ansehen", actionHref: "/quotes" },
    { time: "12:30", title: "Mittagspause", description: "Gönn dir was!", status: "pause", actionLabel: "In 2 Std." },
    { time: "14:30", title: "Versand vorbereiten", description: "6 Aufträge bereitstellen.", status: "upcoming", actionLabel: "Ansehen", actionHref: "/orders" },
    { time: "16:30", title: "Tagesabschluss", description: "Offene Punkte prüfen & abschließen.", status: "upcoming", actionLabel: "Checkliste" }
  ];
  return NextResponse.json(timeline);
}
