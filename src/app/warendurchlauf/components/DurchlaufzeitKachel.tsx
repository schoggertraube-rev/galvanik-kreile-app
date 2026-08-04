"use client";

import { useState } from "react";
import { Tile } from "@/app/buchhaltung/components/Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { Clock } from "lucide-react";
import type { WarendurchlaufKpiData } from "../actions";

export function DurchlaufzeitKachel({ data }: { data: WarendurchlaufKpiData | null }) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [referenceTime] = useState(() => Date.now());

  const dlz = data?.durchlaufzeitTage ?? 0;
  const orders = data?.orders || [];
  
  // Find longest running active orders
  const activeOrders = orders.filter(o => o.status !== "completed" && o.status !== "abgeschlossen");
  const sortedLongest = activeOrders.sort((a, b) => {
    const aDate = a.intakeDate ? new Date(a.intakeDate).getTime() : referenceTime;
    const bDate = b.intakeDate ? new Date(b.intakeDate).getTime() : referenceTime;
    return aDate - bDate; // Oldest first
  }).slice(0, 5);

  const compositionRows = sortedLongest.length > 0 ? sortedLongest.map(o => {
    const daysActive = o.intakeDate ? ((referenceTime - new Date(o.intakeDate).getTime()) / (1000 * 60 * 60 * 24)).toFixed(1) : 0;
    return {
      avatar: o.orderNumber?.charAt(0) || "A",
      avatarColor: Number(daysActive) > 14 ? "bg-error-red" : "bg-accent-orange",
      name: `${o.orderNumber} (${o.currentStationId || "Unbekannt"})`,
      amount: `${daysActive} Tage`,
      href: `/orders/${o.id}`
    };
  }) : [{ avatar: "✓", avatarColor: "bg-teal-500", name: "Keine Aufträge in Bearbeitung", amount: "", href: "#" }];

  return (
    <>
      <Tile
        icon={<Clock className="w-6 h-6" />}
        iconColor="text-navy-900"
        title="Durchlaufzeit"
        kpi={`${dlz} Tage`}
        description="Ø pro Auftrag"
        footer="Gleitender Durchschnitt"
        onClick={() => setOverlayOpen(true)}
        analyseLink={{ label: "Details ansehen", onClick: () => setOverlayOpen(true) }}
      />

      <AnalysisOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        title="Durchlaufzeit Detail"
        subtitle="Analysieren Sie die Dauer der einzelnen Aufträge."
        hero={{
          kicker: "Durchschnittliche DLZ",
          value: `${dlz} Tage`,
          changePill: { text: "Basierend auf Livedaten", variant: "gray" }
        }}
        composition={{
          title: "Am längsten in Bearbeitung",
          rows: compositionRows
        }}
        insight={{
          body: sortedLongest.length > 0 ? "Überprüfen Sie diese Aufträge auf Liegezeiten." : "Keine auffälligen Liegezeiten."
        }}
        linkedAreas={[
          { label: "Bäder-Status", href: "/baeder" },
          { label: "Qualitätssicherung", href: "/kontrolle" }
        ]}
      />
    </>
  );
}
