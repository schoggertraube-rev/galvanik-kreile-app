import { hasAnyAuthorizationArea, hasAuthorizationArea, type AuthorizationSnapshot } from "@/lib/server/authorization";
import { getOperationalOrders } from "@/lib/server/operationalOrders";
import { readTodayDashboard } from "@/lib/server/todayDashboard";
import type { OperationalOrder } from "@/lib/types/operationalOrder";
import {
  buildOrdersHomeProjection,
  type OrdersHomeSource,
} from "@/modules/orders/public";
import { RolfHomeClient, type RolfHomeModel } from "./RolfHomeClient";
import { saveTodayPreferencesAction, saveTodayReminderAction } from "@/app/actions/today.actions";
import { discardIntakeDraftAction } from "@/app/actions/intakeDraft.actions";
import { assignOrderTaskAction } from "@/app/actions/orders.actions";

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
  if (!hasAnyAuthorizationArea(authorization)) return { kind: "no_areas" };

  try {
    const [orders, dashboard] = await Promise.all([getOperationalOrders(authorization), readTodayDashboard(authorization)]);
    const common = {
      role: authorization.role,
      canCreateOrder: hasAuthorizationArea(authorization, "eingang"),
      canWorkOrders: hasAuthorizationArea(authorization, "auftraege"),
      canDelegate: hasAuthorizationArea(authorization, "auftraege"),
      dashboard,
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
  return <RolfHomeClient model={await loadRolfHome(authorization)} ports={{
    savePreferences: saveTodayPreferencesAction,
    saveReminder: saveTodayReminderAction,
    discardDraft: discardIntakeDraftAction,
    assignOrder: assignOrderTaskAction,
  }} />;
}
