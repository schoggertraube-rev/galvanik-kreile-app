"use client";

import { useRef, useState } from "react";
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
  currentStationId,
  currentStatus,
  onCompleteStation
}: StationStatusButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startRequestId = useRef<string | null>(null);

  const handleStartStation = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      startRequestId.current ||= crypto.randomUUID();
      const result = await transitionOrderProcess({
        orderId,
        action: "start",
        expectedStation: currentStationId,
        clientRequestId: startRequestId.current,
      });
      if (!result.ok) {
        setError(result.message || "Bearbeitung konnte nicht bestätigt gestartet werden.");
        return;
      }
      startRequestId.current = null;
      window.dispatchEvent(new Event("kreile-orders-updated"));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Bearbeitung konnte nicht bestätigt gestartet werden.");
    } finally {
      setIsSubmitting(false);
    }
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

  if (currentStatus !== "ready") {
    return (
      <div className="h-24 w-full flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-neutral-gray-200 bg-bg-app-soft p-3 text-center text-text-muted">
        <Play className="w-5 h-5" />
        <span className="text-xs font-bold">Station ist nicht startbereit</span>
        {error && <span role="alert" className="text-[10px] text-danger-red">{error}</span>}
      </div>
    );
  }

  return (
    <Button 
      onClick={() => void handleStartStation()}
      disabled={isSubmitting}
      className="h-24 w-full flex flex-col gap-2 rounded-2xl bg-navy-700 hover:bg-navy-700 text-white shadow-lg active:scale-95 transition-all"
    >
      <Play className="w-6 h-6" />
      <span className="font-bold">{isSubmitting ? "Wird bestätigt..." : "Bearbeitung starten"}</span>
      {error && <span role="alert" className="text-[10px] text-red-200">{error}</span>}
    </Button>
  );
}
