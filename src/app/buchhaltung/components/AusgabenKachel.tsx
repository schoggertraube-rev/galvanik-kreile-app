"use client";
import { Wallet } from "lucide-react";
import { Tile } from "./Tile";

export function AusgabenKachel({ gesamtAusgaben }: { gesamtAusgaben: number }) {
  return (
    <Tile
      datenherkunft={{ belege: 142, rechnungen: 38, zeitbuchungen: 0, verbrauchsbuchungen: 0, periodeLabel: "06/2026", periodeStatus: "offen" }}
      title="Ausgaben & Kostenstruktur"
      description="Fix- und variable Kosten auf einen Blick. Filterbar nach Typ, Zeitraum und Kategorie."
      icon={<Wallet className="w-5 h-5 text-amber-600" strokeWidth={1.8} />}
      iconColor="bg-amber-50"
      href="/buchhaltung/kosten"
      kpi={`${gesamtAusgaben.toLocaleString("de-DE")} €`}
      footer="Kosten & Ausgaben"
    />
  );
}



