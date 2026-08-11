import { ORDER_DETAIL_READ_NOT_AVAILABLE_MESSAGE } from "./repositories/orderQueries";

export function useOrderLive(_orderId: string | null) {
  void _orderId;
  return {
    orderData: null,
    loading: false,
    error: ORDER_DETAIL_READ_NOT_AVAILABLE_MESSAGE,
    denial: ORDER_DETAIL_READ_NOT_AVAILABLE_MESSAGE,
    refresh: () => undefined,
  };
}
