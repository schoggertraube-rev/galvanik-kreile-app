import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  getOrderWithDetails,
  type OrderDetailsDto,
} from "./repositories/orderQueries";

type OrderLiveState = {
  orderId: string;
  data: OrderDetailsDto | null;
  loading: boolean;
};

export function useOrderLive(orderId: string | null) {
  const [state, setState] = useState<OrderLiveState>({
    orderId: "",
    data: null,
    loading: false,
  });

  useEffect(() => {
    if (!orderId) return;

    let isMounted = true;

    const fetchInitial = async () => {
      const data = await getOrderWithDetails(orderId);
      if (isMounted) {
        setState({ orderId, data, loading: false });
      }
    };

    void fetchInitial();

    // Finance-bearing relations are refreshed only through the authorized server DTO.
    const channel = supabase
      .channel(`order_live_${orderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `order_id=eq.${orderId}` }, fetchInitial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `order_id=eq.${orderId}` }, fetchInitial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'communications', filter: `order_id=eq.${orderId}` }, fetchInitial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints', filter: `order_id=eq.${orderId}` }, fetchInitial)
      .subscribe();

    const handleFocusSync = () => void fetchInitial();
    window.addEventListener("kreile-sync-focus", handleFocusSync);

    return () => {
      isMounted = false;
      window.removeEventListener("kreile-sync-focus", handleFocusSync);
      void supabase.removeChannel(channel);
    };
  }, [orderId]);

  if (!orderId) return { orderData: null, loading: false };
  if (state.orderId !== orderId) return { orderData: null, loading: true };
  return { orderData: state.data, loading: state.loading };
}
