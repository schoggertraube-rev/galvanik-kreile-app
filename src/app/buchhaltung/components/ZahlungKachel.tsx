"use client";
import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Tile } from "./Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";

export function ZahlungKachel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tile
        title="Bankkonto & Cashflow"
        description="Liquidität, Kontostände, Zahlungslinks und Zahlungsmoral."
        icon={<CreditCard className="w-5 h-5 text-teal-600" strokeWidth={1.8} />}
        iconColor="bg-teal-50"
        onClick={() => setOpen(true)}
        status={{ label: "Live", variant: "ready" }}
        kpi="0,00 €"
        footer="Verfügbare Liquidität"
        analyseLink={{ label: "Analyse", href: "#", onClick: () => setOpen(true) }}
      />

      <AnalysisOverlay
        open={open}
        onClose={() => setOpen(false)}
        title="Bankkonto & Cashflow"
        subtitle="Live-Übersicht der Liquidität und Transaktionen."
        hero={{
          kicker: "Gesamtliquidität",
          value: "0,00 €",
          changePill: { text: "Noch keine Daten", variant: "neutral" },
          meta: "Summe aus Bankguthaben und kurzfristigen Forderungen abzüglich Verbindlichkeiten."
        }}
        composition={{
          title: "Konten & Kassen",
          rows: [
            { avatar: "S", avatarColor: "bg-teal-600", name: "Sparkasse (Geschäftskonto)", amount: "0,00 €", href: "/buchhaltung/zahlung" },
            { avatar: "V", avatarColor: "bg-navy-900", name: "Volksbank (Rücklagen)", amount: "0,00 €", href: "/buchhaltung/zahlung" },
            { avatar: "K", avatarColor: "bg-gray-500", name: "Kasse (Bar)", amount: "0,00 €", href: "/buchhaltung/zahlung" }
          ]
        }}
        insight={{
          body: "Bisher liegen keine ausreichenden Daten vor, um die Zahlungsmoral der Kunden zu bewerten."
        }}
        linkedAreas={[
          { label: "Offene Posten (OPOS)", href: "/buchhaltung/rechnungen" },
          { label: "Ausgaben & Belege", href: "/buchhaltung/ausgaben" },
          { label: "Performance Dashboard", href: "/performance" }
        ]}
      />
    </>
  );
}
