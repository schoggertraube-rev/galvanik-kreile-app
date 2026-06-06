"use client";

import { useState } from "react";
import { Tile } from "@/app/buchhaltung/components/Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { Calendar } from "lucide-react";
import Link from "next/link";

export function TermintreueKachel() {
  const [overlayOpen, setOverlayOpen] = useState(false);

  return (
    <>
      <Tile
        icon={<Calendar className="w-6 h-6" />}
        iconColor="text-navy-900"
        title="Termintreue"
        kpi="94.2%"
        description="Zuletzt 7 Tage"
        footer="Trend: +2.1%"
        onClick={() => setOverlayOpen(true)}
        analyseLink={{ label: "Details ansehen", onClick: () => setOverlayOpen(true) }}
      />

      <AnalysisOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        title="Termintreue Detail"
        subtitle="Analysieren Sie terminkritische Aufträge und Verzögerungen."
        hero={{
          kicker: "Gesamt Termintreue",
          value: "94.2 %",
          changePill: { text: "+2.1% als Vormonat", variant: "teal" }
        }}
        composition={{
          title: "Kritische Aufträge",
          rows: [
            { avatar: "M", avatarColor: "bg-error-red", name: "A-2026-0089 (Muster GmbH)", amount: "Morgen", href: "/orders/1" },
            { avatar: "R", avatarColor: "bg-error-red", name: "A-2026-0091 (Riedel AG)", amount: "Überfällig", href: "/orders/2" }
          ]
        }}
        insight={{
          body: "2 Aufträge benötigen sofortige Aufmerksamkeit an der Verzinkungsstation."
        }}
        linkedAreas={[
          { label: "Zur Kontrolle", href: "/kontrolle" },
          { label: "Kunden informieren", href: "/customers" }
        ]}
      />
    </>
  );
}
