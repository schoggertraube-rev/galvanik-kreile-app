"use client";

import { createContext, useContext, type ReactNode } from "react";

type RealtimeStatus = "disabled";

interface RealtimeContextType {
  status: RealtimeStatus;
}

const RealtimeContext = createContext<RealtimeContextType>({ status: "disabled" });

/**
 * Realtime is an authorization path. Until W3 proves tenant-scoped Realtime
 * access and negative RLS cases, no browser Supabase client is created and no
 * channel is subscribed.
 */
export function useRealtimeStatus() {
  return useContext(RealtimeContext);
}

export function RealtimeSyncProvider({ children }: { children: ReactNode }) {
  return (
    <RealtimeContext.Provider value={{ status: "disabled" }}>
      {children}
    </RealtimeContext.Provider>
  );
}
