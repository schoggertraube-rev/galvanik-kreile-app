"use client";
import { CalendarClock } from "lucide-react";
import { Tile } from "./Tile";

export function FristenKachel() {
  return (
    <Tile
      title="Fristen & Pflichten"
      description="UStVA, GewSt, Rundfunkbeitrag. Rechtzeitige Erinnerung, nie verpassen."
      icon={<CalendarClock className="w-5 h-5 text-accent-orange" strokeWidth={1.8} />}
      iconColor="bg-accent-orange/10"
      href="/buchhaltung/fristen"
      status={{ label: "Überwacht", variant: "ready" }}
      footer="Kalender"
    />
  );
}



