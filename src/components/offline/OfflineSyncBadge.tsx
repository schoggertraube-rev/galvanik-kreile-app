"use client";

import { useSync } from "@/lib/offline/SyncContext";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";

export function OfflineSyncBadge() {
  const {isOnline,outboxItems}=useSync();
  const isOffline=!isOnline,pendingCount=outboxItems.length;

  if (!isOffline && pendingCount === 0) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex flex-col gap-1 text-[11px] font-bold p-3 rounded-xl shadow-lg border animate-in slide-in-from-bottom-2 ${isOffline ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
      <div className="flex items-center gap-2">
        {isOffline ? <CloudOff className="w-4 h-4 text-amber-600" /> : <Cloud className="w-4 h-4 text-blue-600" />}
        <span>{isOffline ? "Offline – Eingaben werden lokal gesichert" : "Wieder Online"}</span>
      </div>
      
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 mt-1 opacity-90">
          <RefreshCw className={`w-3 h-3 ${isOffline ? '' : 'animate-spin'}`} />
          <span>{pendingCount} Eingabe(n) warten auf Synchronisierung</span>
        </div>
      )}

    </div>
  );
}
