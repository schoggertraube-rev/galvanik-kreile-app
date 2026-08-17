"use client";

import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";

interface ErfassungSheetProps {
  orderId: string;
  stationKuerzel?: string;
  mode: "zeit" | "material" | "beides";
  vorlage?: unknown;
  onSuccess: () => void;
  onClose: () => void;
}

export function ErfassungSheet({ orderId, stationKuerzel, mode, vorlage, onSuccess, onClose }: ErfassungSheetProps) {
  void orderId;
  void stationKuerzel;
  void mode;
  void vorlage;
  void onSuccess;
  void onClose;
  return <FoundationUnavailable />;
}
