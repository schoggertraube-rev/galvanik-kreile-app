"use client";

import { useState } from "react";
import { Tile } from "@/app/buchhaltung/components/Tile";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { Calendar } from "lucide-react";
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

export function TermintreueKachel({ data }: { data: WarendurchlaufKpiData | null }) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [renderedAt] = useState(() => Date.now());

  const termintreue = data?.termintreue ?? null;
  const metricValue = termintreue === null ? "–" : `${termintreue} %`;
  const orders = data?.orders ?? [];
  
  const openOrders = orders.filter((order) => isOpenStatus(order.status));
  const nextDueOrders = openOrders
    .filter((order) => validTimestamp(order.promisedDueDate) !== null)
    .sort((a, b) => Number(validTimestamp(a.promisedDueDate)) - Number(validTimestamp(b.promisedDueDate)))
    .slice(0, 5);

  const compositionRows = !data ? [{
    avatar: "!", avatarColor: "bg-neutral-gray-400", name: "Zusagetermine nicht verfügbar", amount: "",
  }] : nextDueOrders.length > 0 ? nextDueOrders.map((order) => {
    const promisedAt = validTimestamp(order.promisedDueDate);
    const isOverdue = promisedAt !== null && promisedAt < renderedAt;
    return {
      avatar: order.orderNumber.charAt(0) || "A",
      avatarColor: isOverdue ? "bg-error-red" : "bg-amber-500",
      name: `${order.orderNumber} ${order.task ? `(${order.task})` : ""}`,
      amount: isOverdue ? "Überfällig" : new Date(Number(promisedAt)).toLocaleDateString("de-DE"),
      href: `/orders/${order.id}`,
    };
  }) : [{ avatar: "✓", avatarColor: "bg-neutral-gray-400", name: "Keine offenen Aufträge mit bestätigtem Zusagetermin", amount: "" }];

  return (
    <>
      <Tile
        icon={<Calendar className="w-6 h-6" />}
        iconColor="text-navy-900"
        title="Termintreue"
        kpi={metricValue}
        description="Pünktlich abgeschlossene Aufträge"
        footer={data ? `${data.termintreueMessbar} / ${data.abgeschlosseneAuftraege} Abschlüsse messbar · ${data.termintreueOhneMessdaten} ausgeschlossen` : "Daten nicht verfügbar"}
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
          value: metricValue,
          changePill: { text: termintreue === null ? "Noch nicht messbar" : "Aus bestätigten Abschlussdaten", variant: "gray" }
        }}
        composition={{
          title: "Nächste Zusagetermine",
          rows: compositionRows
        }}
        insight={{
          body: termintreue === null
            ? "Termintreue wird erst ausgewiesen, sobald abgeschlossene Aufträge sowohl einen Zusagetermin als auch ein bestätigtes Abschlussdatum besitzen."
            : `${data?.termintreueMessbar ?? 0} von ${data?.abgeschlosseneAuftraege ?? 0} Abschlüssen sind messbar; ${data?.termintreueOhneMessdaten ?? 0} wurden wegen fehlender Zusage- oder Abschlusszeit ausgeschlossen.`
        }}
        linkedAreas={[
          { label: "Zur Kontrolle", href: "/kontrolle" },
          { label: "Kunden informieren", href: "/kommunikation" }
        ]}
      />
    </>
  );
}
