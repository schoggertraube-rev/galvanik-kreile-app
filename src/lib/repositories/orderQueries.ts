import type { communications, customers, events, items, orderCostPositions, orders, payments, priceLines } from "@/db/schema";

export const ORDER_DETAIL_READ_NOT_AVAILABLE_MESSAGE =
  "NOT_AVAILABLE: Auftragsdetailansicht benötigt einen tenant- und ownership-geprüften W3-Read-Vertrag.";

export type OrderDetails = typeof orders.$inferSelect & {
  customer: typeof customers.$inferSelect | null;
  items: Array<typeof items.$inferSelect>;
  events: Array<typeof events.$inferSelect>;
  priceLines: Array<typeof priceLines.$inferSelect>;
  payments: Array<typeof payments.$inferSelect>;
  communications: Array<typeof communications.$inferSelect>;
  costPositions: Array<typeof orderCostPositions.$inferSelect>;
  customerKpis: { ltv: number; activeOrdersCount: number };
};

export async function getOrderWithDetails(orderId: string): Promise<OrderDetails | null> {
  void orderId;
  return null;
}
