"use client";

import { useState } from "react";
import { Tile } from "@/app/buchhaltung/components/Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { AlertTriangle } from "lucide-react";
import type { WarendurchlaufKpiData } from "@/app/warendurchlauf/actions";
import { isTerminalOrderStatus, normalizeStoredOrderStatus } from "@/lib/orders/orderMutationContract";

function isOpenStatus(value: string): boolean {
  const status = normalizeStoredOrderStatus(value);
  return status !== "unknown" && !isTerminalOrderStatus(status);
}

export function EngpassKachel({ data }: { data: WarendurchlaufKpiData | null }) {
  const [overlayOpen, setOverlayOpen] = useState(false);

  const engpassStation = data?.engpassStation ?? "–";
  const engpassCount = data?.engpassCount ?? null;
  const orders = data?.orders ?? [];

  const stations: Record<string, number> = {};
  orders.filter((order) => isOpenStatus(order.status)).forEach((order) => {
    const station = order.currentStationId?.trim();
    if (!station) return;
    stations[station] = (stations[station] || 0) + 1;
  });

  const sortedStations = Object.entries(stations).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const stationRows = sortedStations.map(([station, count]) => {
    return {
      avatar: station.charAt(0).toUpperCase(),
      avatarColor: count > 5 ? "bg-error-red" : "bg-accent-orange",
      name: station,
      amount: `${count} Aufträge`,
      href: "/orders",
    };
  });
  const compositionRows = stationRows.length > 0
    ? [
        ...stationRows,
        ...(data && data.offeneOhneStation > 0 ? [{
          avatar: "?",
          avatarColor: "bg-neutral-gray-400",
          name: "Station nicht zugeordnet",
          amount: `${data.offeneOhneStation} Aufträge`,
          href: "/orders",
        }] : []),
      ]
    : [{
        avatar: data ? "✓" : "!",
        avatarColor: data ? "bg-teal-500" : "bg-neutral-gray-400",
        name: data ? "Keine messbare Stationslast" : "Stationsdaten nicht verfügbar",
        amount: data && data.offeneOhneStation > 0 ? `${data.offeneOhneStation} nicht zugeordnet` : "",
      }];

  return (
    <>
      <Tile
        icon={<AlertTriangle className="w-6 h-6" />}
        iconColor={engpassCount === null ? "text-neutral-gray-400" : engpassCount > 0 ? "text-accent-orange" : "text-teal-600"}
        title="Stationslast-Radar"
        kpi={engpassStation}
        description={data ? (engpassCount !== null && engpassCount > 0 ? "Höchster offener Auftragsbestand · kein Kapazitätsnachweis" : "Keine messbare Stationslast") : "Daten nicht verfügbar"}
        onClick={() => setOverlayOpen(true)}
        analyseLink={{ label: "Details ansehen", onClick: () => setOverlayOpen(true) }}
      />

      <AnalysisOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        title="Offene Stationslast"
        subtitle="Vergleicht offene Aufträge je gespeicherter Station; Kapazität und Bearbeitungsrate sind nicht angebunden."
        hero={{
          kicker: "Höchster offener Bestand",
          value: engpassStation,
          changePill: {
            text: engpassCount === null ? "Daten nicht verfügbar" : `${engpassCount} Aufträge in der Station`,
            variant: engpassCount !== null && engpassCount > 0 ? "red" : "gray",
          }
        }}
        composition={{
          title: "Offene Aufträge nach Station",
          rows: compositionRows
        }}
        insight={{
          body: !data
            ? "Ohne bestätigte Auftragsdaten wird kein Engpass behauptet."
            : engpassCount !== null && engpassCount > 0
              ? `${engpassStation} hat mit ${engpassCount} Aufträgen den höchsten offenen Bestand. Ohne Kapazitäts- und Bearbeitungsraten ist das kein nachgewiesener Engpass.`
              : data.offeneOhneStation > 0
                ? `${data.offeneOhneStation} offene Aufträge besitzen keine Stationszuordnung und sind nicht im Ranking enthalten.`
                : "Keine Station verzeichnet offene Aufträge."
        }}
        linkedAreas={[
          { label: "Bäder-Verwaltung", href: "/baeder" }
        ]}
      />
    </>
  );
}
