"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

type RealtimeStatus = "connecting" | "active" | "disconnected" | "disabled";

interface RealtimeContextType {
  status: RealtimeStatus;
}

const RealtimeContext = createContext<RealtimeContextType>({ status: "disabled" });

export function useRealtimeStatus() {
  return useContext(RealtimeContext);
}

export function RealtimeSyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const isSupabase = process.env.NEXT_PUBLIC_DATA_PROVIDER === 'supabase';

  useEffect(() => {
    if (!isSupabase) {
      setStatus("disabled");
      return;
    }

    const supabase = createClient();
    let channel: RealtimeChannel;

    // Dispatch global event so repositories can listen
    const dispatchSync = (table: string, payload?: Record<string, unknown>) => {
      console.log(`[RealtimeSync] DB Change detected on ${table}`, payload);
      window.dispatchEvent(new CustomEvent(`kreile-sync-${table}`, { detail: payload }));
      window.dispatchEvent(new CustomEvent('kreile-sync', { detail: { table, payload } }));
    };

    // Focus fallback: Re-fetch when user switches back to tab
    const handleFocus = () => {
      console.log("[RealtimeSync] Window focused, triggering soft sync");
      window.dispatchEvent(new CustomEvent('kreile-sync-focus'));
    };

    window.addEventListener('focus', handleFocus);

    const connectRealtime = () => {
      setStatus("connecting");
      
      channel = supabase.channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' },
          (payload) => {
            if (payload.table) {
              dispatchSync(payload.table, payload);
            }
          }
        )
        .subscribe((subscribeStatus, err) => {
          if (subscribeStatus === 'SUBSCRIBED') {
            setStatus("active");
          } else if (subscribeStatus === 'CLOSED' || subscribeStatus === 'CHANNEL_ERROR') {
            setStatus("disconnected");
            console.error("[RealtimeSync] Channel error/closed:", err);
            
            // Auto-reconnect after 5 seconds
            setTimeout(() => {
              if (document.visibilityState === 'visible') {
                supabase.removeChannel(channel).then(connectRealtime);
              }
            }, 5000);
          }
        });
    };

    connectRealtime();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && status === 'disconnected') {
        supabase.removeChannel(channel).then(connectRealtime);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isSupabase]);

  return (
    <RealtimeContext.Provider value={{ status }}>
      {children}
    </RealtimeContext.Provider>
  );
}
