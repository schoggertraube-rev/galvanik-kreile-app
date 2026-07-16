"use client";

import { useState } from "react";
import { Tile } from "@/app/buchhaltung/components/Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { Clock } from "lucide-react";
import type { WarendurchlaufKpiData } from "@/app/warendurchlauf/actions";
import { isTerminalOrderStatus, normalizeStoredOrderStatus } from "@/lib/orders/orderMutationContract";

function isOpenStatus(value: string): boolean {
  const status = normalizeStoredOrderStatus(value);
  return status !== "unknown" && !isTerminalOrderStatus(status);
}

function validTimestamp(value: string | undefined): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function DurchlaufzeitKachel({ data }: { data: WarendurchlaufKpiData | null }) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [renderedAt] = useState(() => Date.now());

  const dlz = data?.durchlaufzeitTage ?? null;
  const metricValue = dlz === null ? "–" : `${dlz} Tage`;
  const orders = data?.orders ?? [];
  
  const activeOrders = orders.filter((order) => isOpenStatus(order.status));
  const sortedLongest = [...activeOrders].sort((a, b) => {
    const aDate = validTimestamp(a.intakeDate) ?? Infinity;
    const bDate = validTimestamp(b.intakeDate) ?? Infinity;
    return aDate - bDate;
  }).slice(0, 5);

  const compositionRows = !data ? [{
    avatar: "!", avatarColor: "bg-neutral-gray-400", name: "Durchlaufdaten nicht verfügbar", amount: "",
  }] : sortedLongest.length > 0 ? sortedLongest.map((order) => {
    const intakeAt = validTimestamp(order.intakeDate);
    const daysActive = intakeAt !== null && intakeAt <= renderedAt
      ? ((renderedAt - intakeAt) / (1000 * 60 * 60 * 24)).toFixed(1)
      : null;
    return {
      avatar: order.orderNumber.charAt(0) || "A",
      avatarColor: daysActive !== null && Number(daysActive) > 14 ? "bg-error-red" : "bg-accent-orange",
      name: `${order.orderNumber} (${order.currentStationId || "Unbekannt"})`,
      amount: daysActive === null ? "Startdatum fehlt" : `${daysActive} Tage aktiv`,
      href: `/orders/${order.id}`,
    };
  }) : [{ avatar: "✓", avatarColor: "bg-neutral-gray-400", name: "Keine bestätigten Aufträge in Bearbeitung", amount: "" }];

  return (
    <>
      <Tile
        icon={<Clock className="w-6 h-6" />}
        iconColor="text-navy-900"
        title="Durchlaufzeit"
        kpi={metricValue}
        description="Ø abgeschlossener Auftrag"
        footer={data ? `${data.durchlaufzeitMessbar} / ${data.abgeschlosseneAuftraege} Abschlüsse messbar · ${data.durchlaufzeitOhneMessdaten} ausgeschlossen` : "Daten nicht verfügbar"}
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
          value: metricValue,
          changePill: { text: dlz === null ? "Noch nicht messbar" : "Aus bestätigten Abschlussdaten", variant: "gray" }
        }}
        composition={{
          title: "Am längsten in Bearbeitung",
          rows: compositionRows
        }}
        insight={{
          body: dlz === null
            ? "Die Durchlaufzeit wird erst ausgewiesen, sobald abgeschlossene Aufträge ein gültiges Start- und Abschlussdatum besitzen."
            : `${data?.durchlaufzeitMessbar ?? 0} von ${data?.abgeschlosseneAuftraege ?? 0} Abschlüssen sind messbar; ${data?.durchlaufzeitOhneMessdaten ?? 0} wurden wegen fehlender oder ungültiger Start-/Endzeit ausgeschlossen. ${sortedLongest.length > 0 ? "Die Liste zeigt offene Laufzeiten, keine bestätigten Ursachen." : "Keine offenen Laufzeiten vorhanden."}`
        }}
        linkedAreas={[
          { label: "Bäder-Status", href: "/baeder" },
          { label: "Qualitätssicherung", href: "/kontrolle" }
        ]}
      />
    </>
  );
}
