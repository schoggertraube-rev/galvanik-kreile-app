"use client";
import { Banknote } from "lucide-react";
import { Tile } from "./Tile";

export function SteuerprofilKachel() {
  return (
    <Tile
      title="Steuerprofil & UStVA"
      description="USt-Sätze, Voranmeldungs-Rhythmus, Berater-Nr. ELSTER-Einstellungen."
      icon={<Banknote className="w-5 h-5 text-purple-600" strokeWidth={1.8} />}
      iconColor="bg-purple-50"
      href="/buchhaltung/steuerprofil"
      kpi="DE"
      footer="Details"
    />
  );
}



