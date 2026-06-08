"use client";
import { Banknote } from "lucide-react";
import { Tile } from "./Tile";

export function SteuerprofilKachel() {
  return (
    <Tile
      datenherkunft={{ belege: 142, rechnungen: 38, zeitbuchungen: 0, verbrauchsbuchungen: 0, periodeLabel: "06/2026", periodeStatus: "offen" }}
      title="Steuerprofil & Gewinn"
      description="USt-Sätze, Voranmeldungs-Rhythmus, Berater-Nr. ELSTER-Einstellungen."
      icon={<Banknote className="w-5 h-5 text-purple-600" strokeWidth={1.8} />}
      iconColor="bg-purple-50"
      href="/buchhaltung/steuerprofil"
      kpi="DE"
      footer="Details"
    />
  );
}



