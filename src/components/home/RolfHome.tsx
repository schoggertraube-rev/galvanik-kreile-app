import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { getOperationalOrders } from "@/lib/server/operationalOrders";
import type { OperationalOrder } from "@/lib/types/operationalOrder";
import { RolfHomeClient, type RolfHomeModel, type RolfOrder } from "./RolfHomeClient";

function toRolfOrder(order: OperationalOrder): RolfOrder {
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
      displayName: authorization.displayName,
      role: authorization.role,
      canCreateOrder: authorization.permissions.includes("perm_data_orders"),
    } as const;
    return orders.length === 0
      ? { kind: "empty", ...common }
      : { kind: "data", ...common, orders: orders.map(toRolfOrder) };
  } catch {
    return { kind: "error", message: "Der Tag konnte nicht sicher geladen werden." };
  }
}

export async function RolfHome({ authorization }: { authorization: AuthorizationSnapshot }) {
  return <RolfHomeClient model={await loadRolfHome(authorization)} />;
}
