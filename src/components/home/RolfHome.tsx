import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { getOperationalOrders } from "@/lib/server/operationalOrders";
import type { OperationalOrder } from "@/lib/types/operationalOrder";
import { RolfHomeClient, type RolfHomeOrder, type RolfHomeView } from "./RolfHomeClient";

function orderSurface(order: OperationalOrder): RolfHomeOrder {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    title: order.title,
    task: order.task,
    itemDescription: order.itemDescription,
    station: order.station,
    status: order.status,
    statusText: order.statusText,
    risk: order.risk,
    dueDate: order.dueDate,
    dueLabel: order.dueLabel,
    dueValue: order.dueValue,
  };
}

export async function loadRolfHomeView(authorization: AuthorizationSnapshot): Promise<RolfHomeView> {
  if (!["buero", "meister", "readonly"].includes(authorization.role)) {
    return { kind: "denied", message: "Diese Rollen-Startseite ist nicht freigegeben." };
  }
  try {
    const orders = await getOperationalOrders(authorization);
    const common = {
      displayName: authorization.displayName,
      role: authorization.role as "buero" | "meister" | "readonly",
      canCreateOrder: authorization.permissions.includes("perm_data_orders") && authorization.role !== "readonly",
    };
    if (orders.length === 0) return { kind: "empty", ...common };
    return { kind: "data", ...common, orders: orders.map(orderSurface) };
  } catch {
    return { kind: "error", message: "Tagesansicht konnte nicht sicher geladen werden." };
  }
}

export async function RolfHome({ authorization }: { authorization: AuthorizationSnapshot }) {
  return <RolfHomeClient view={await loadRolfHomeView(authorization)} />;
}
