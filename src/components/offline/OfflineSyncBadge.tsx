"use client";

import { useEffect, useState } from "react";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { Cloud, CloudOff, RefreshCw, AlertCircle } from "lucide-react";

export function OfflineSyncBadge() {
  const [isOffline, setIsOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    const updateState = async () => {
      setIsOffline(OfflineManager.isOffline());
      const count = await OfflineManager.getPendingCount();
      setPendingCount(count);
    };

    updateState();

    const handleOffline = () => updateState();
    const handleOnline = () => updateState();
    const handleSyncUpdate = () => updateState();
    const handleSyncSuccess = () => {
      setLastSync(new Date().toLocaleTimeString());
      updateState();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("kreile-network-change", handleOffline);
    window.addEventListener("kreile-sync-queue-updated", handleSyncUpdate);
    window.addEventListener("kreile-sync-success", handleSyncSuccess);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("kreile-network-change", handleOffline);
      window.removeEventListener("kreile-sync-queue-updated", handleSyncUpdate);
      window.removeEventListener("kreile-sync-success", handleSyncSuccess);
    };
  }, []);

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

      {lastSync && pendingCount === 0 && (
        <div className="flex items-center gap-2 mt-1 opacity-70">
          <AlertCircle className="w-3 h-3" />
          <span>Zuletzt synchronisiert: {lastSync}</span>
        </div>
      )}
    </div>
  );
}
