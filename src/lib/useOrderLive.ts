import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getOrderWithDetails } from "./repositories/orderQueries";

export function useOrderLive(orderId: string | null) {
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!orderId) {
      setOrderData(null);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchInitial = async () => {
      const data = await getOrderWithDetails(orderId);
      if (isMounted) {
        setOrderData(data);
        setLoading(false);
      }
    };

    setOrderData(null);
    setLoading(true);
    fetchInitial();

    // Supabase Realtime Subscription for this order
    const channel = supabase
      .channel(`order_live_${orderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, fetchInitial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `order_id=eq.${orderId}` }, fetchInitial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `order_id=eq.${orderId}` }, fetchInitial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'communications', filter: `order_id=eq.${orderId}` }, fetchInitial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_lines', filter: `order_id=eq.${orderId}` }, fetchInitial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `order_id=eq.${orderId}` }, fetchInitial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints', filter: `order_id=eq.${orderId}` }, fetchInitial)
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return { orderData, loading };
}
