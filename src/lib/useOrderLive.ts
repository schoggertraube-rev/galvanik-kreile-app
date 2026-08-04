import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getOrderWithDetails } from "./repositories/orderQueries";

type OrderWithDetails = Awaited<ReturnType<typeof getOrderWithDetails>>;

interface OrderRequestSnapshot {
  orderId: string;
  orderData: OrderWithDetails;
}

export function useOrderLive(orderId: string | null) {
  const [snapshot, setSnapshot] = useState<OrderRequestSnapshot | null>(null);
  const matchingSnapshot = snapshot?.orderId === orderId ? snapshot : null;
  const orderData = matchingSnapshot?.orderData ?? null;
  const loading = orderId !== null && matchingSnapshot === null;

  useEffect(() => {
    if (!orderId) return;

    let isMounted = true;

    const fetchInitial = async () => {
      const data = await getOrderWithDetails(orderId);
      if (isMounted) {
        setSnapshot({ orderId, orderData: data });
      }
    };

    void fetchInitial();

    // Supabase Realtime Subscription for this order
    const channel = supabase
      .channel(`order_live_${orderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, fetchInitial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `order_id=eq.${orderId}` }, fetchInitial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `order_id=eq.${orderId}` }, fetchInitial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'communications', filter: `order_id=eq.${orderId}` }, fetchInitial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_lines', filter: `order_id=eq.${orderId}` }, fetchInitial)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_cost_positions', filter: `order_id=eq.${orderId}` }, fetchInitial)
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
