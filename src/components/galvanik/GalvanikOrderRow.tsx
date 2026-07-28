"use client";

import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";
import type { Order } from "@/lib/repositories/ordersRepository";

type GalvanikOrderRowProps = {
  order: Order;
};

/**
 * Preserve the export shape for dormant legacy imports while preventing its
 * former inferred urgency and no-op decision path from becoming reachable.
 */
export function GalvanikOrderRow({ order: _order }: GalvanikOrderRowProps) {
void _order;
  return (
    <FoundationUnavailable
      title="Stationsdetail ist noch nicht freigegeben"
      reason="Die frühere Detailzeile konnte aus ungesicherten Daten Dringlichkeit und Folgeaktionen ableiten. Bis zum vollständigen Prozessvertrag werden keine Stationsentscheidungen dargestellt."
    />
  );
}
