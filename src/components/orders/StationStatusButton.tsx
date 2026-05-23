"use client";

import { useState } from "react";
import { Play, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { eventsRepository } from "@/lib/repositories/eventsRepository";
import { ordersRepository } from "@/lib/repositories/ordersRepository";
import { STATION_CONFIGS } from "@/constants/stations";
import { createStatusEvent } from "@/app/actions/status-events.actions";

interface StationStatusButtonProps {
  orderId: string;
  customerId?: string;
  currentStationId: string;
  currentStatus: string;
  onCompleteStation?: () => void;
}

export function StationStatusButton({
  orderId,
  customerId,
  currentStationId,
  currentStatus,
  onCompleteStation
}: StationStatusButtonProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [selectedStation, setSelectedStation] = useState(currentStationId || "wareneingang");

  const handleStartStation = async () => {
    setSelectedStation(currentStationId || "wareneingang");
    setIsStarting(true);
  };

  const executeStart = async () => {
    const sel = selectedStation;
    await ordersRepository.updateOrder(orderId, { currentStationId: sel, station: sel, status: "in_progress" });
    await eventsRepository.addEvent({ orderId, customerId, eventType: "STATION_STARTED", metadata: { stationId: sel } });
    createStatusEvent({ orderId, eventType: "STATION_STARTED", notes: `Station: ${sel}` }).catch(e => console.warn(e));
    if (typeof window !== "undefined") window.dispatchEvent(new Event("storage"));
    setIsStarting(false);
  };

  if (currentStatus === "in_progress") {
    return (
      <Button 
        onClick={onCompleteStation} 
        className="h-24 w-full flex flex-col gap-2 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white shadow-lg active:scale-95 transition-all"
      >
        <CheckCircle className="w-6 h-6" />
        <span className="font-bold">Station abschließen</span>
      </Button>
    );
  }

  if (isStarting) {
    return (
      <div className="h-24 w-full flex flex-col justify-center gap-2 rounded-2xl bg-blue-50 border-2 border-blue-600 p-2">
        <select 
          className="w-full text-xs p-1 rounded border border-slate-200 bg-white" 
          value={selectedStation} 
          onChange={(e) => setSelectedStation(e.target.value)}
        >
          {Object.values(STATION_CONFIGS).map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setIsStarting(false)} className="flex-1 h-6 text-xs px-0">Abbrechen</Button>
          <Button size="sm" className="flex-1 h-6 text-xs bg-blue-600 text-white px-0" onClick={executeStart}>Starten</Button>
        </div>
      </div>
    );
  }

  return (
    <Button 
      onClick={handleStartStation} 
      className="h-24 w-full flex flex-col gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg active:scale-95 transition-all"
    >
      <Play className="w-6 h-6" />
      <span className="font-bold">Station starten</span>
    </Button>
  );
}
