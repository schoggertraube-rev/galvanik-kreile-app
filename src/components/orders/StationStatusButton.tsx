"use client";

import { AlertTriangle } from "lucide-react";

interface StationStatusButtonProps {
  orderId: string;
  customerId?: string;
  currentStationId: string;
  currentStatus: string;
  onCompleteStation?: () => void;
}

/** Legacy detail UI must never choose a station or write an event itself. */
export function StationStatusButton(_props: StationStatusButtonProps) {
  return (
    <div className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-50 p-3 text-center text-sm text-amber-950">
      <AlertTriangle className="h-5 w-5" />
      <span className="font-semibold">Prozessaktion noch nicht freigegeben</span>
    </div>
  );
}
