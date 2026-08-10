"use client";

import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

interface WareneingangReadOnlyProps {
  orderId: string;
  orderRevenue: number;
  orderMargin: number;
  orderMarginPercent: number;
}

export function WareneingangReadOnly({ orderId, orderRevenue, orderMargin, orderMarginPercent }: WareneingangReadOnlyProps) {
  void orderId;
  void orderRevenue;
  void orderMargin;
  void orderMarginPercent;
  return <FoundationUnavailable />;
}
