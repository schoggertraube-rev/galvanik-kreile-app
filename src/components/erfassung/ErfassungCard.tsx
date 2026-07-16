"use client";

import { CaptureCard } from "./CaptureCard";

/** @deprecated Neue Aufrufer sollen CaptureCard direkt verwenden. */
export function ErfassungCard({
  orderId,
  stationKuerzel,
}: {
  orderId: string;
  stationKuerzel?: string | null;
  tenantId?: string;
}) {
  return <CaptureCard orderId={orderId} stationKuerzel={stationKuerzel} />;
}
