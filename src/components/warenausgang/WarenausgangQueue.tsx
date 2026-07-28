"use client";

import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";
import type { Order } from "@/lib/repositories/ordersRepository";

type WarenausgangQueueProps = {
  allOrders: Order[];
};

/**
 * Legacy delivery handling inferred completion, generated local PDFs and could
 * present a completed dispatch without a shipment or printer receipt. Keep the
 * export inert until the dedicated shipping contract has passed W3/W5.
 */
export function WarenausgangQueue({ allOrders: _allOrders }: WarenausgangQueueProps) {
  return (
    <FoundationUnavailable
      title="Warenausgang ist noch nicht freigegeben"
      reason="Die frühere Warteschlange leitete Versand- und Druckzustände aus lokalen Daten ab. Ohne nachweisbaren Versand-, PDF- und Receipt-Vertrag wird kein Auftrag als bereit oder versandt dargestellt."
    />
  );
}
