"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type RefreshStatus = "ready" | "refreshing" | "offline" | "disabled";

interface RefreshContextType {
  status: RefreshStatus;
}

const RefreshContext = createContext<RefreshContextType>({ status: "disabled" });

export function useRealtimeStatus() {
  return useContext(RefreshContext);
}

export function RealtimeSyncProvider({ children }: { children: ReactNode }) {
  const enabled = process.env.NEXT_PUBLIC_SERVER_REFRESH_ENABLED !== "false";
  const [status, setStatus] = useState<RefreshStatus>(enabled ? "ready" : "disabled");

  useEffect(() => {
    if (!enabled) return;

    let settleTimer: number | undefined;
    const triggerRefresh = () => {
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      setStatus("refreshing");
      window.dispatchEvent(new CustomEvent("kreile-sync-focus", {
        detail: { source: "periodic-server-refresh" },
      }));
      if (settleTimer !== undefined) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => setStatus("ready"), 250);
    };
    const markOffline = () => setStatus("offline");
    const handleVisibility = () => {
      if (document.visibilityState === "visible") triggerRefresh();
    };

    window.addEventListener("focus", triggerRefresh);
    window.addEventListener("online", triggerRefresh);
    window.addEventListener("offline", markOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    const initialTimer = window.setTimeout(triggerRefresh, 0);
    const interval = window.setInterval(triggerRefresh, 30_000);

    return () => {
      window.removeEventListener("focus", triggerRefresh);
      window.removeEventListener("online", triggerRefresh);
      window.removeEventListener("offline", markOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearTimeout(initialTimer);
      if (settleTimer !== undefined) window.clearTimeout(settleTimer);
      window.clearInterval(interval);
    };
  }, [enabled]);

  return <RefreshContext.Provider value={{ status }}>{children}</RefreshContext.Provider>;
}
