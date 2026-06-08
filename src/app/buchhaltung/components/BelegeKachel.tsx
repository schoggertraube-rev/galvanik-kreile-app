"use client";
import { Receipt } from "lucide-react";
import { Tile } from "./Tile";

export function BelegeKachel() {
  return (
    <Tile
      datenherkunft={{ belege: 142, rechnungen: 38, zeitbuchungen: 0, verbrauchsbuchungen: 0, periodeLabel: "06/2026", periodeStatus: "offen" }}
      title="Belege erfassen & prüfen"
      description="Foto rein, Inhalt automatisch erkannt & kategorisiert. 3 von 142 unsicher."
      icon={<Receipt className="w-5 h-5 text-accent-orange" strokeWidth={1.8} />}
      iconColor="bg-accent-orange/10"
      href="/buchhaltung/belege"
      status={{ label: "3 prüfen", variant: "action" }}
    />
  );
}



