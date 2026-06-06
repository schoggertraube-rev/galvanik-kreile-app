"use client";
import { CreditCard } from "lucide-react";
import { Tile } from "./Tile";

export function ZahlungKachel() {
  return (
    <Tile
      title="Zahlungsbereich"
      description="Dienstleister, Zahlungslinks, QR, Vor-Ort-Terminal. Zahlungsmoral & Zahlungsstatistik."
      icon={<CreditCard className="w-5 h-5 text-teal-600" strokeWidth={1.8} />}
      iconColor="bg-teal-50"
      href="/buchhaltung/zahlung"
      status={{ label: "In Vorbereitung", variant: "prep" }}
      footer="Optionen & Statistik"
      analyseLink={{ label: "Analyse", href: "/buchhaltung/zahlung?tab=statistik" }}
    />
  );
}



