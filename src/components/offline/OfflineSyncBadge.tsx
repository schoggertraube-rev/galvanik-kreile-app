"use client";

import { useEffect, useState } from "react";
import {
  OfflineManager,
  type BrowserNetworkStatus,
  type SyncQueueResult,
} from "@/lib/offline/OfflineManager";
import { AlertCircle, Cloud, CloudOff } from "lucide-react";

export function OfflineSyncBadge() {
  const [networkStatus, setNetworkStatus] = useState<BrowserNetworkStatus>("unknown");
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SyncQueueResult | null>(null);

  useEffect(() => {
    let active = true;
    const updateState = async () => {
      setNetworkStatus(OfflineManager.getBrowserNetworkStatus());
      try {
        const count = await OfflineManager.getPendingCount();
        if (!active) return;
        setPendingCount(count);
        setQueueError(null);
      } catch (error) {
        console.error("Offline queue count failed", error);
        if (!active) return;
        setPendingCount(null);
        setQueueError("Lokale Warteschlange ist nicht lesbar; Anzahl unbekannt.");
      }
    };

    void updateState();

    const handleNetwork = () => { void updateState(); };
    const handleSyncUpdate = () => { void updateState(); };
    const handleSyncComplete = (event: Event) => {
      const result = (event as CustomEvent<SyncQueueResult>).detail;
      setLastResult(result);
      setLastCheck(new Date().toLocaleTimeString("de-DE"));
      void updateState();
    };

    window.addEventListener("offline", handleNetwork);
    window.addEventListener("online", handleNetwork);
    window.addEventListener("kreile-network-change", handleNetwork);
    window.addEventListener("kreile-sync-queue-updated", handleSyncUpdate);
    window.addEventListener("kreile-sync-complete", handleSyncComplete);

    return () => {
      active = false;
      window.removeEventListener("offline", handleNetwork);
      window.removeEventListener("online", handleNetwork);
      window.removeEventListener("kreile-network-change", handleNetwork);
      window.removeEventListener("kreile-sync-queue-updated", handleSyncUpdate);
      window.removeEventListener("kreile-sync-complete", handleSyncComplete);
    };
  }, []);

  if (pendingCount === null && !queueError) return null;
  if (networkStatus === "available" && pendingCount === 0 && !queueError) return null;

  const browserOffline = networkStatus === "offline";
  const blocked = (lastResult?.blocked ?? 0) > 0;
  const headline = queueError
    ? "Lokaler Speicherstatus unbekannt"
    : browserOffline
      ? "Browser meldet kein Netzwerk"
      : blocked
        ? "Übertragung blockiert"
        : "Netzwerk verfügbar – Backend nicht geprüft";

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex flex-col gap-1 text-[11px] font-bold p-3 rounded-xl shadow-lg border animate-in slide-in-from-bottom-2 ${browserOffline || queueError || blocked ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
      <div className="flex items-center gap-2">
        {browserOffline ? <CloudOff className="w-4 h-4 text-amber-600" /> : <Cloud className="w-4 h-4 text-blue-600" />}
        <span>{headline}</span>
      </div>

      {queueError ? (
        <div className="flex items-center gap-2 mt-1 opacity-90">
          <AlertCircle className="w-3 h-3" />
          <span>{queueError}</span>
        </div>
      ) : pendingCount !== null && pendingCount > 0 ? (
        <div className="flex items-center gap-2 mt-1 opacity-90">
          <AlertCircle className="w-3 h-3" />
          <span>{pendingCount} lokale Eingabe(n) ohne bestätigten Backend-Beleg</span>
        </div>
      ) : null}

      {lastCheck && (
        <div className="flex items-center gap-2 mt-1 opacity-70">
          <AlertCircle className="w-3 h-3" />
          <span>Zuletzt geprüft: {lastCheck}</span>
        </div>
      )}
    </div>
  );
}
