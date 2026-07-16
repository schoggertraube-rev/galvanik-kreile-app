"use client";

import { useState } from "react";
import { Tile } from "@/app/buchhaltung/components/Tile";
import { DetailOverlay } from "@/components/ui/DetailOverlay";
import { ListTodo } from "lucide-react";
import { OrderWideCard, UrgencyType } from "@/components/orders/OrderWideCard";
import { useOverlayStore } from "@/lib/overlayStore";
import type { WarendurchlaufKpiData } from "@/app/warendurchlauf/actions";
import { isTerminalOrderStatus, normalizeStoredOrderStatus } from "@/lib/orders/orderMutationContract";

function isOpenStatus(value: string): boolean {
  const status = normalizeStoredOrderStatus(value);
  return status !== "unknown" && !isTerminalOrderStatus(status);
}

export function OffeneAuftraegeKachel({ data }: { data: WarendurchlaufKpiData | null }) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const { openOrder } = useOverlayStore();

  const offeneCount = data?.offeneAuftraege ?? null;
  const orders = data?.orders ?? [];

  const activeOrders = orders.filter((order) => isOpenStatus(order.status));
  const sortedRecent = [...activeOrders].sort((a, b) => {
    const aDate = a.intakeDate ? new Date(a.intakeDate).getTime() : 0;
    const bDate = b.intakeDate ? new Date(b.intakeDate).getTime() : 0;
    return bDate - aDate; // Newest first
  });

  return (
    <>
      <Tile
        icon={<ListTodo className="w-6 h-6" />}
        iconColor="text-navy-900"
        title="Offene Aufträge"
        kpi={offeneCount === null ? "–" : String(offeneCount)}
        description={data ? "Aktiv im Durchlauf" : "Daten nicht verfügbar"}
        footer={!data
          ? "Daten nicht bestätigt"
          : data.unbekannteStatuswerte > 0
            ? `${data.unbekannteStatuswerte} Statuswerte ungeklärt`
            : "Bestätigter Live-Stand"}
        onClick={() => setOverlayOpen(true)}
        analyseLink={{ label: "Details ansehen", onClick: () => setOverlayOpen(true) }}
      />

      <DetailOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        title="Offene Aufträge"
        subtitle={offeneCount === null ? "Auftragsdaten sind derzeit nicht verfügbar." : `${offeneCount} Aufträge sind aktuell in der Produktion.`}
      >
        <div className="flex flex-col gap-3">
          {sortedRecent.length > 0 ? (
            sortedRecent.map((o) => {
              const dueValue = o.dueValue || "—";
              const dueLabel = o.dueLabel || (o.dueValue ? "Termin" : "Kein Termin");
              const urgency: UrgencyType = o.risk === "red"
                ? "crit"
                : (o.risk === "yellow" || o.risk === "orange")
                  ? "soon"
                  : o.risk === "green"
                    ? "ok"
                    : "wait";
              const partsStr = o.parts.length > 0 ? o.parts.map((part) => part.name).join(", ") : "Artikel nicht hinterlegt";
              const surfaceStr = o.parts[0]?.surfaceRequested || "Oberfläche nicht hinterlegt";

              return (
                <OrderWideCard
                  key={o.id}
                  id={o.id}
                  orderNumber={o.orderNumber}
                  customerName={o.customerName || "Kunde nicht hinterlegt"}
                  article={partsStr}
                  surface={surfaceStr}
                  urgency={urgency}
                  dueValue={dueValue}
                  dueLabel={dueLabel}
                  badgeText={o.status || "Offen"}
                  onClick={() => openOrder(o.id)}
                />
              );
            })
          ) : (
            <div className="p-8 text-center bg-white border border-dashed border-neutral-gray-300 rounded-2xl flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-neutral-gray-100 text-neutral-gray-400 rounded-full flex items-center justify-center mb-3">
                <ListTodo className="w-6 h-6" />
              </div>
              <p className="text-navy-900 font-semibold mb-1">{data ? "Keine offenen Aufträge" : "Aufträge nicht verfügbar"}</p>
              <p className="text-text-muted text-sm">{data ? "Aktuell befinden sich keine Aufträge im Durchlauf." : "Die Datenquelle hat keinen bestätigten Erfolg geliefert."}</p>
            </div>
          )}
        </div>
      </DetailOverlay>
    </>
  );
}
