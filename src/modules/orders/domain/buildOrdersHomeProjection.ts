export type OrdersHomeSource = {
  id: string;
  orderNumber: string;
  customerName: string | null;
  title: string;
  detail: string | null;
  station: string;
  status: string;
  statusText: string;
  risk: string;
  dueDate: string;
  dueLabel: string;
  dueValue: string;
};

export type OrdersHomeProjection = {
  source: "Auftragsbestand";
  loadedAt: string;
  orders: readonly OrdersHomeSource[];
  priority: readonly OrdersHomeSource[];
  dominant: null | {
    orderId: string;
    reason: string;
  };
};

const RISK_ORDER: Readonly<Record<string, number>> = {
  red: 0,
  blocked: 1,
  orange: 2,
  yellow: 3,
  green: 4,
};

function dueTimestamp(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function validTimestamp(value: string): boolean {
  const parsed = new Date(value);
  return value.length > 0 && !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function assertSource(order: OrdersHomeSource): void {
  if (
    !order || !order.id || !order.orderNumber || !order.title || !order.station || !order.status
    || !order.statusText || !order.risk || !order.dueDate || !order.dueLabel || !order.dueValue
  ) throw new Error("ORDERS_HOME_SOURCE_INVALID");
}

function dominantReason(order: OrdersHomeSource): string {
  if (order.risk === "red") return "Persistierter Risikostatus: kritisch";
  if (order.risk === "blocked") return "Persistierter Risikostatus: blockiert";
  if (order.risk === "orange") return "Persistierter Risikostatus: dringend";
  if (order.risk === "yellow") return "Persistierter Risikostatus: knapp";
  return `${order.dueLabel}: ${order.dueValue}`;
}

export function buildOrdersHomeProjection(
  orders: readonly OrdersHomeSource[],
  loadedAt: string,
): OrdersHomeProjection {
  if (!Array.isArray(orders) || !validTimestamp(loadedAt)) throw new Error("ORDERS_HOME_PROJECTION_INVALID");
  orders.forEach(assertSource);
  const priority = [...orders]
    .sort((left, right) => {
      const risk = (RISK_ORDER[left.risk] ?? 5) - (RISK_ORDER[right.risk] ?? 5);
      if (risk !== 0) return risk;
      const due = dueTimestamp(left.dueDate) - dueTimestamp(right.dueDate);
      return due !== 0 ? due : left.orderNumber.localeCompare(right.orderNumber, "de");
    })
    .slice(0, 6);
  const first = priority[0];
  return {
    source: "Auftragsbestand",
    loadedAt,
    orders: [...orders],
    priority,
    dominant: first ? { orderId: first.id, reason: dominantReason(first) } : null,
  };
}
