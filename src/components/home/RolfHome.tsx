import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { getOperationalOrders } from "@/lib/server/operationalOrders";
import type { OperationalOrder } from "@/lib/types/operationalOrder";
import {
  buildOrdersHomeProjection,
  type OrdersHomeSource,
} from "@/modules/orders/public";
import { RolfHomeClient, type RolfHomeModel } from "./RolfHomeClient";

function toHomeSource(order: OperationalOrder): OrdersHomeSource {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    title: order.title,
    detail: order.itemDescription ?? order.task,
    station: order.station,
    status: order.status,
    statusText: order.statusText,
    risk: order.risk,
    dueDate: order.dueDate,
    dueLabel: order.dueLabel,
    dueValue: order.dueValue,
    createdAt: order.createdAt ?? null,
  };
}

export async function loadRolfHome(authorization: AuthorizationSnapshot): Promise<RolfHomeModel> {
  if (authorization.role !== "buero" && authorization.role !== "meister" && authorization.role !== "readonly") {
    return { kind: "denied", message: "Diese Rollen-Startseite ist nicht freigegeben." };
  }
  if (!authorization.permissions.includes("perm_view_leitstand")) {
    return { kind: "denied", message: "Der Tagesbestand ist für diese Rolle nicht freigegeben." };
  }

  try {
    const orders = await getOperationalOrders(authorization);
    const common = {
      role: authorization.role,
      canCreateOrder: authorization.permissions.includes("perm_data_orders"),
    } as const;
    const projection = buildOrdersHomeProjection(orders.map(toHomeSource), new Date().toISOString());
    return orders.length === 0
      ? { kind: "empty", ...common, projection }
      : { kind: "data", ...common, projection };
  } catch {
    return { kind: "error", message: "Die aktuellen Auftragsdaten konnten nicht sicher geladen werden." };
  }
}

export async function RolfHome({ authorization }: { authorization: AuthorizationSnapshot }) {
  return <RolfHomeClient model={await loadRolfHome(authorization)} />;
}
