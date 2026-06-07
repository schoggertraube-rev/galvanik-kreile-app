"use client";

import { useState } from "react";
import { Tile } from "@/app/buchhaltung/components/Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export function EngpassKachel({ data }: { data: any }) {
  const [overlayOpen, setOverlayOpen] = useState(false);

  const engpassStation = data?.engpassStation || "Kein Engpass";
  const engpassCount = data?.engpassCount || 0;
  const orders = data?.orders || [];

  // Group by station
  const stations: Record<string, number> = {};
  orders.filter((o: any) => o.status !== "completed" && o.status !== "abgeschlossen").forEach((o: any) => {
    const s = o.currentStationId || "wareneingang";
    stations[s] = (stations[s] || 0) + 1;
  });

  const sortedStations = Object.entries(stations).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const compositionRows = sortedStations.length > 0 ? sortedStations.map(([station, count]) => {
    return {
      avatar: station.charAt(0).toUpperCase(),
      avatarColor: count > 5 ? "bg-error-red" : "bg-accent-orange",
      name: station,
      amount: `${count} Aufträge`,
      href: `/warendurchlauf/${station}`
    };
  }) : [{ avatar: "✓", avatarColor: "bg-teal-500", name: "Keine Engpässe", amount: "", href: "#" }];

  return (
    <>
      <Tile
        icon={<AlertTriangle className="w-6 h-6" />}
        iconColor={engpassCount > 0 ? "text-error-red" : "text-teal-600"}
        title="Engpass-Radar"
        kpi={engpassStation}
        description={engpassCount > 0 ? "Höchste Last" : "Alles im Plan"}
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
          value: engpassStation,
          changePill: { text: `${engpassCount} Aufträge in der Station`, variant: engpassCount > 0 ? "red" : "gray" }
        }}
        composition={{
          title: "Stau nach Stationen",
          rows: compositionRows
        }}
        insight={{
          body: engpassCount > 0 ? `${engpassStation} hat mit ${engpassCount} Aufträgen die höchste Last.` : "Keine Station verzeichnet auffälligen Stau."
        }}
        linkedAreas={[
          { label: "Bäder-Verwaltung", href: "/baeder" }
        ]}
      />
    </>
  );
}
