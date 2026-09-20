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
  createdAt: string | null;
};

export type OrdersHomeProjection = {
  source: "Auftragsbestand";
  loadedAt: string;
  orders: readonly OrdersHomeSource[];
  priority: readonly OrdersHomeSource[];
  recent: readonly OrdersHomeSource[];
  recentSince: string;
  recentCoverage: "complete" | "partial";
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
  if (order.createdAt !== null && !validTimestamp(order.createdAt)) {
    throw new Error("ORDERS_HOME_SOURCE_INVALID");
  }
}

function dominantReason(order: OrdersHomeSource): string {
  if (order.risk === "red") return "Dieser Auftrag ist kritisch.";
  if (order.risk === "blocked") return "Dieser Auftrag ist blockiert.";
  if (order.risk === "orange") return "Dieser Auftrag ist dringend.";
  if (order.risk === "yellow") return "Der Termin dieses Auftrags wird knapp.";
  return `${order.dueLabel}: ${order.dueValue}`;
}

export function buildOrdersHomeProjection(
  orders: readonly OrdersHomeSource[],
  loadedAt: string,
): OrdersHomeProjection {
  if (!Array.isArray(orders) || !validTimestamp(loadedAt)) throw new Error("ORDERS_HOME_PROJECTION_INVALID");
  orders.forEach(assertSource);
  const loadedTimestamp = new Date(loadedAt).getTime();
  const recentSince = new Date(loadedTimestamp - 24 * 60 * 60 * 1000).toISOString();
  const priority = [...orders]
    .sort((left, right) => {
      const risk = (RISK_ORDER[left.risk] ?? 5) - (RISK_ORDER[right.risk] ?? 5);
      if (risk !== 0) return risk;
      const due = dueTimestamp(left.dueDate) - dueTimestamp(right.dueDate);
      return due !== 0 ? due : left.orderNumber.localeCompare(right.orderNumber, "de");
    })
    .slice(0, 6);
  const recent = orders
    .filter((order) => {
      if (order.createdAt === null) return false;
      const timestamp = new Date(order.createdAt).getTime();
      return timestamp >= new Date(recentSince).getTime() && timestamp <= loadedTimestamp;
    })
    .sort((left, right) => new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime());
  const first = priority[0];
  return {
    source: "Auftragsbestand",
    loadedAt,
    orders: [...orders],
    priority,
    recent,
    recentSince,
    recentCoverage: orders.every((order) => order.createdAt !== null) ? "complete" : "partial",
    dominant: first ? { orderId: first.id, reason: dominantReason(first) } : null,
  };
}
