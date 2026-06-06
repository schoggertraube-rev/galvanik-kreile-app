"use client";
import { Download, FileCheck } from "lucide-react";
import { Tile } from "./Tile";

export function ExportKachel() {
  return (
    <>
      <Tile
        title="DATEV-Export"
        description="Buchungsstapel (EXTF, SKR03) + Belegbilder. Vorschau & ein-Klick-Übergabe."
        icon={<Download className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />}
        iconColor="bg-emerald-50"
        href="/buchhaltung/export?format=datev"
        status={{ label: "Bereit", variant: "ready" }}
        footer="Vorschau öffnen"
      />
      <Tile
        title="Lexware / Excel"
        description="Einfacher CSV-Export für Lexware oder Tabellenkalkulation."
        icon={<FileCheck className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />}
        iconColor="bg-emerald-50"
        href="/buchhaltung/export?format=lexware"
        status={{ label: "Bereit", variant: "ready" }}
        footer="Vorschau öffnen"
      />
    </>
  );
}



