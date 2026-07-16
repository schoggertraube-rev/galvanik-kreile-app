import { useEffect, useState } from "react";
import { getOrderWithDetails } from "./repositories/orderQueries";

type OrderDetails = NonNullable<Awaited<ReturnType<typeof getOrderWithDetails>>>;

export function useOrderLive(orderId: string | null) {
  const [snapshot, setSnapshot] = useState<{
    orderId: string;
    data: OrderDetails | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!orderId) return;

    let isMounted = true;

    const fetchInitial = async () => {
      try {
        const data = await getOrderWithDetails(orderId);
        if (isMounted) {
          setSnapshot({
            orderId,
            data,
            error: data ? null : "Auftrag wurde nicht gefunden.",
          });
        }
      } catch (fetchError) {
        if (isMounted) {
          setSnapshot({
            orderId,
            data: null,
            error: fetchError instanceof Error ? fetchError.message : "Auftragsdaten konnten nicht aktualisiert werden.",
          });
        }
      }
    };

    fetchInitial();

    const refresh = () => void fetchInitial();
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("kreile-orders-updated", refresh);
    window.addEventListener("online", refresh);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      window.removeEventListener("kreile-orders-updated", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [orderId]);

  const current = orderId && snapshot?.orderId === orderId ? snapshot : null;
  return {
    orderData: current?.data ?? null,
    loading: Boolean(orderId && !current),
    error: current?.error ?? null,
    refreshMode: "polling" as const,
  };
}
