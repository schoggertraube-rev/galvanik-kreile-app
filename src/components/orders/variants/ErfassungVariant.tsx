"use client";

import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

interface ErfassungVariantProps {
  orderId: string;
  station: string;
  onBooked?: () => void;
  orderRevenue: number;
  orderMargin: number;
  orderMarginPercent: number;
}

export function ErfassungVariant({ orderId, station, onBooked, orderRevenue, orderMargin, orderMarginPercent }: ErfassungVariantProps) {
  void orderId;
  void station;
  void onBooked;
  void orderRevenue;
  void orderMargin;
  void orderMarginPercent;
  return <FoundationUnavailable />;
}
