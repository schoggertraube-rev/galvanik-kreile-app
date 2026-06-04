"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
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
  const isSupabase = process.env.NEXT_PUBLIC_DATA_PROVIDER === 'supabase';
  const [status, setStatus] = useState<RealtimeStatus>(isSupabase ? "connecting" : "disabled");
  const statusRef = useRef<RealtimeStatus>(isSupabase ? "connecting" : "disabled");

  // Sync ref with state
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!isSupabase) {
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
      
      // Subscribing to specific tables rather than schema wildcard to avoid socket closure (1006) for public role
      channel = supabase.channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          (payload) => dispatchSync('orders', payload)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'customers' },
          (payload) => dispatchSync('customers', payload)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'items' },
          (payload) => dispatchSync('items', payload)
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'events' },
          (payload) => dispatchSync('events', payload)
        )
        .subscribe((subscribeStatus, err) => {
          if (subscribeStatus === 'SUBSCRIBED') {
            setStatus("active");
          } else if (subscribeStatus === 'CLOSED' || subscribeStatus === 'CHANNEL_ERROR') {
            setStatus("disconnected");
            
            if (err) {
              const errorWithMetadata = err as Error & { details?: string; hint?: string };
              console.error("[RealtimeSync] Channel error/closed:", {
                message: err.message,
                details: errorWithMetadata.details || "No details provided",
                hint: errorWithMetadata.hint || "No hint provided",
                error: err
              });
            } else if (subscribeStatus === 'CLOSED') {
              console.log("[RealtimeSync] Channel cleanly closed (typically due to backgrounding tab).");
            } else {
              console.warn(`[RealtimeSync] Channel status changed to ${subscribeStatus} without an explicit error object.`);
            }
            
            // Auto-reconnect after 5 seconds
            setTimeout(() => {
              if (document.visibilityState === 'visible' && statusRef.current === 'disconnected') {
                supabase.removeChannel(channel).then(connectRealtime);
              }
            }, 5000);
          }
        });
    };

    connectRealtime();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && statusRef.current === 'disconnected') {
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
