"use client";

import { useState } from "react";
import { Play, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { transitionOrderProcess } from "@/app/actions/orders.actions";

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
  const [isStarting, setIsStarting] = useState(false);
  const handleStartStation = async () => {
    setIsStarting(true);
  };

  const executeStart = async () => {
    const result = await transitionOrderProcess({ orderId, action: "start" });
    if (!result.ok) {
      window.alert(result.message);
      return;
    }
    if (typeof window !== "undefined") window.dispatchEvent(new Event("storage"));
    setIsStarting(false);
  };

  if (currentStatus === "in_progress") {
    return (
      <Button 
        onClick={onCompleteStation} 
        className="h-24 w-full flex flex-col gap-2 rounded-2xl bg-navy-900 hover:bg-navy-900 text-white shadow-lg active:scale-95 transition-all"
      >
        <CheckCircle className="w-6 h-6" />
        <span className="font-bold">Station abschließen</span>
      </Button>
    );
  }

  if (isStarting) {
    return (
      <div className="h-24 w-full flex flex-col justify-center gap-2 rounded-2xl bg-gold-100 border-2 border-navy-700 p-2">
        <p className="text-xs text-navy-900 text-center">Station wird gestartet</p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setIsStarting(false)} className="flex-1 h-6 text-xs px-0">Abbrechen</Button>
          <Button size="sm" className="flex-1 h-6 text-xs bg-navy-700 text-white px-0" onClick={executeStart}>Starten</Button>
        </div>
      </div>
    );
  }

  return (
    <Button 
      onClick={handleStartStation} 
      className="h-24 w-full flex flex-col gap-2 rounded-2xl bg-navy-700 hover:bg-navy-700 text-white shadow-lg active:scale-95 transition-all"
    >
      <Play className="w-6 h-6" />
      <span className="font-bold">Bearbeitung starten</span>
    </Button>
  );
}
