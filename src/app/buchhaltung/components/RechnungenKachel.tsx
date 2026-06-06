"use client";
import { FileCheck } from "lucide-react";
import { Tile } from "./Tile";

export function RechnungenKachel() {
  return (
    <Tile
      title="Rechnungen & Statistik"
      description="Ausgangsrechnungen laufender Monat. Schreiben, E-Rechnung (ZUGFeRD/XRechnung)."
      icon={<FileCheck className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />}
      iconColor="bg-emerald-50"
      href="/buchhaltung/rechnungen"
      kpi="42"
      footer="Details"
    />
  );
}



