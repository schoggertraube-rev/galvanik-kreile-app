import { useMemo } from "react";

/**
 * Realtime order reads need W3 tenant/RLS proof.  Null is deliberately paired
 * with an explicit error so it cannot be rendered as an empty order.
 */
export function useOrderLive(_orderId: string | null) {
  return useMemo(() => ({
    orderData: null,
    loading: false,
    error: new Error("NOT_CONFIGURED: Auftrags-Realtime ist noch nicht freigegeben."),
  }), []);
}
