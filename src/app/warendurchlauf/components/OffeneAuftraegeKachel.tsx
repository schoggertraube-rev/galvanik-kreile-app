"use client";

import { useState } from "react";
import { Tile } from "@/app/buchhaltung/components/Tile";
import { DetailOverlay } from "@/components/ui/DetailOverlay";
import { ListTodo } from "lucide-react";
import { OrderWideCard, UrgencyType } from "@/components/orders/OrderWideCard";
import { useOverlayStore } from "@/lib/overlayStore";
import type { WarendurchlaufKpiData, WarendurchlaufOrder } from "../actions";

function getLegacySurface(part: WarendurchlaufOrder["parts"][number] | undefined) {
  if (
    part &&
    typeof part === "object" &&
    "surface" in part &&
    typeof part.surface === "string"
  ) {
    return part.surface;
  }

  return undefined;
}

export function OffeneAuftraegeKachel({ data }: { data: WarendurchlaufKpiData | null }) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const openOrder = useOverlayStore(state => state.openOrder);

  const offeneCount = data?.offeneAuftraege ?? 0;
  const orders = data?.orders || [];

  // Get all active orders
  const activeOrders = orders.filter(o => o.status !== "completed" && o.status !== "abgeschlossen" && o.status !== "versendet");
  const sortedRecent = activeOrders.sort((a, b) => {
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
        kpi={String(offeneCount)}
        description="Aktiv im Durchlauf"
        footer="Live-Stand"
        onClick={() => setOverlayOpen(true)}
        analyseLink={{ label: "Details ansehen", onClick: () => setOverlayOpen(true) }}
      />

      <DetailOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        title="Offene Aufträge"
        subtitle={`${offeneCount} Aufträge sind aktuell in der Produktion.`}
      >
        <div className="flex flex-col gap-3">
          {sortedRecent.length > 0 ? (
            sortedRecent.map(o => {
              const dueValue = o.dueValue || "---";
              const dueLabel = o.dueLabel || "Fällig";
              const urgency: UrgencyType = o.risk === "red" ? "crit" : (o.risk === "yellow" ? "soon" : "ok");
              const partsStr = o.parts.length > 0 ? o.parts.map(p => p.name).join(", ") : "Artikel nicht hinterlegt";
              const surfaceStr = getLegacySurface(o.parts[0]) || "Oberfläche nicht hinterlegt";

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
              <p className="text-navy-900 font-semibold mb-1">Keine offenen Aufträge</p>
              <p className="text-text-muted text-sm">Aktuell befinden sich keine Aufträge im Durchlauf.</p>
            </div>
          )}
        </div>
      </DetailOverlay>
    </>
  );
}
