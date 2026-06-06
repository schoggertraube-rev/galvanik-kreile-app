"use client";

import { useState } from "react";
import { Tile } from "@/app/buchhaltung/components/Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export function EngpassKachel() {
  const [overlayOpen, setOverlayOpen] = useState(false);

  return (
    <>
      <Tile
        icon={<AlertTriangle className="w-6 h-6" />}
        iconColor="text-error-red"
        title="Engpass-Radar"
        kpi="Galvanik"
        description="Höchste Last"
        onClick={() => setOverlayOpen(true)}
        analyseLink={{ label: "Details ansehen", onClick: () => setOverlayOpen(true) }}
      />

      <AnalysisOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        title="Engpässe"
        subtitle="Analysieren Sie gestaute Stationen."
        hero={{
          kicker: "Kritischster Engpass",
          value: "Galvanik",
          changePill: { text: "92% Auslastung", variant: "red" }
        }}
        composition={{
          title: "Stau nach Stationen",
          rows: [
            { avatar: "3", avatarColor: "bg-error-red", name: "Galvanik-Bad 3", amount: "92%", href: "/warendurchlauf/galvanik" },
            { avatar: "W", avatarColor: "bg-accent-orange", name: "Warenausgang", amount: "14 Aufträge", href: "/warendurchlauf/warenausgang" }
          ]
        }}
        insight={{
          body: "Galvanik-Bad 3 ist überlastet. Aufträge stauen sich."
        }}
        linkedAreas={[
          { label: "Bäder-Verwaltung", href: "/baeder" }
        ]}
      />
    </>
  );
}
