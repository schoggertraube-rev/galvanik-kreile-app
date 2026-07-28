"use client";

import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";
import type { Order } from "@/lib/repositories/ordersRepository";

type GalvanikQueueProps = {
  orders: Order[];
};

/**
 * Historic queue ranked orders with inferred urgency and linked to legacy
 * decision overlays. It is a static quarantine boundary, not a fallback UI.
 */
export function GalvanikQueue({ orders: _orders }: GalvanikQueueProps) {
  return (
    <FoundationUnavailable
      title="Galvanik-Warteschlange ist noch nicht freigegeben"
      reason="Für diese Stationsansicht fehlen der belegte Prozess-, Rollen-, Kapazitäts- und Receipt-Vertrag. Deshalb werden weder Dringlichkeit noch eine bearbeitbare Warteschlange angezeigt."
    />
  );
}
