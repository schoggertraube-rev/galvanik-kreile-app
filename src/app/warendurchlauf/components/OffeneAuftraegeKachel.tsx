"use client";

import { useState } from "react";
import { Tile } from "@/app/buchhaltung/components/Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { ListTodo } from "lucide-react";
import Link from "next/link";

export function OffeneAuftraegeKachel() {
  const [overlayOpen, setOverlayOpen] = useState(false);

  return (
    <>
      <Tile
        icon={<ListTodo className="w-6 h-6" />}
        iconColor="text-navy-900"
        title="Offene Aufträge"
        kpi="142"
        description="Aktiv im Durchlauf"
        footer="Trend: -5"
        onClick={() => setOverlayOpen(true)}
        analyseLink={{ label: "Details ansehen", onClick: () => setOverlayOpen(true) }}
      />

      <AnalysisOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        title="Offene Aufträge"
        subtitle="Alle Aufträge, die sich aktuell im Haus befinden."
        hero={{
          kicker: "Gesamt Offen",
          value: "142",
          changePill: { text: "-5 vs. gestern", variant: "teal" }
        }}
        composition={{
          title: "Neu eingegangen",
          rows: [
            { avatar: "S", avatarColor: "bg-navy-900", name: "A-2026-0098 (Stahlbau GmbH)", amount: "Neu", href: "/orders/1" },
            { avatar: "A", avatarColor: "bg-accent-orange", name: "A-2026-0105 (Auto AG)", amount: "In Bearbeitung", href: "/orders/2" }
          ]
        }}
        insight={{
          body: "Der Auftragsbestand sinkt leicht. Guter Moment, um Wartung an Bad 4 durchzuführen."
        }}
        linkedAreas={[
          { label: "Kunden", href: "/customers" },
          { label: "Abrechenbare Aufträge", href: "/buchhaltung/rechnungen" }
        ]}
      />
    </>
  );
}
