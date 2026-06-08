"use client";
import { FileCheck } from "lucide-react";
import { Tile } from "./Tile";

export function RechnungenKachel() {
  return (
    <Tile
      datenherkunft={{ belege: 142, rechnungen: 38, zeitbuchungen: 0, verbrauchsbuchungen: 0, periodeLabel: "06/2026", periodeStatus: "offen" }}
      title="Rechnungen & Einnahmen"
      description="Ausgangsrechnungen laufender Monat. Schreiben, E-Rechnung (ZUGFeRD/XRechnung)."
      icon={<FileCheck className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />}
      iconColor="bg-emerald-50"
      href="/buchhaltung/rechnungen"
      kpi="42"
      footer="Details"
    />
  );
}



