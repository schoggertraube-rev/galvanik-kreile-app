"use client";

import { useState } from "react";
import { Tile } from "@/app/buchhaltung/components/Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { Clock } from "lucide-react";
import Link from "next/link";

export function DurchlaufzeitKachel() {
  const [overlayOpen, setOverlayOpen] = useState(false);

  return (
    <>
      <Tile
        icon={<Clock className="w-6 h-6" />}
        iconColor="text-navy-900"
        title="Durchlaufzeit"
        kpi="4.2 Tage"
        description="Ø pro Auftrag"
        footer="Trend: -0.3 Tage"
        onClick={() => setOverlayOpen(true)}
        analyseLink={{ label: "Details ansehen", onClick: () => setOverlayOpen(true) }}
      />

      <AnalysisOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        title="Durchlaufzeit Detail"
        subtitle="Analysieren Sie die Dauer der einzelnen Stationen."
        hero={{
          kicker: "Durchschnittliche DLZ",
          value: "4.2 Tage",
          changePill: { text: "-0.3 Tage vs. letzter Monat", variant: "teal" }
        }}
        composition={{
          title: "Top Verzögerungen",
          rows: [
            { avatar: "G", avatarColor: "bg-accent-orange", name: "A-2026-0010 (Galvanik-Bad 2)", amount: "8.5 Std", href: "/orders/1" },
            { avatar: "W", avatarColor: "bg-error-red", name: "A-2026-0044 (Warenausgang)", amount: "12.2 Std", href: "/orders/2" }
          ]
        }}
        insight={{
          body: "Der Warenausgang verzeichnet aktuell die längsten Liegezeiten. Empfehlung: Kapazität prüfen."
        }}
        linkedAreas={[
          { label: "Bäder-Status", href: "/baeder" },
          { label: "Qualitätssicherung", href: "/kontrolle" }
        ]}
      />
    </>
  );
}
