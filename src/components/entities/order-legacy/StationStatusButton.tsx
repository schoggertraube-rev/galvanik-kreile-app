"use client";

import { Play, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StationStatusButtonProps {
  orderId: string;
  customerId?: string;
  currentStationId: string;
  currentStatus: string;
  onCompleteStation?: () => void;
}

export function StationStatusButton({
  orderId,
  currentStatus,
  onCompleteStation
}: StationStatusButtonProps) {
  void orderId;
  void onCompleteStation;

  if (currentStatus === "in_progress") {
    return (
      <Button
        disabled
        className="h-24 w-full flex flex-col gap-2 rounded-2xl bg-navy-900 hover:bg-navy-900 text-white shadow-lg active:scale-95 transition-all"
      >
        <CheckCircle className="w-6 h-6" />
        <span className="font-bold">Station abschließen</span>
        <span className="text-xs">NOT_AVAILABLE: Stationswechsel benötigen den W3-Command-Vertrag.</span>
      </Button>
    );
  }

  return (
    <Button
      disabled
      className="h-24 w-full flex flex-col gap-2 rounded-2xl bg-navy-700 hover:bg-navy-700 text-white shadow-lg active:scale-95 transition-all"
    >
      <Play className="w-6 h-6" />
      <span className="font-bold">Bearbeitung starten</span>
      <span className="text-xs">NOT_AVAILABLE: Stationswechsel benötigen den W3-Command-Vertrag.</span>
    </Button>
  );
}
