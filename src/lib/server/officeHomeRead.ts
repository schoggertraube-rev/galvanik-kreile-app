import "server-only";
import {readCacheLoginScope} from '@/lib/server/authBootstrap';
import {getQuoteFollowupsForTodayAction} from "@/app/actions/quotes.actions";
import {getComplaints} from '@/app/actions/complaints.actions';
import { hasAnyAuthorizationArea, hasAuthorizationArea, type AuthorizationSnapshot } from "@/lib/server/authorization";
import { getOperationalOrders } from "@/lib/server/operationalOrders";
import { readTodayDashboard } from "@/lib/server/todayDashboard";
import type { OperationalOrder } from "@/lib/types/operationalOrder";
import {
  buildOrdersHomeProjection,
  type OrdersHomeSource,
} from "@/modules/orders/public";
import type {OfficeHomeModel} from '@/components/home/OfficeHomeClient';

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

export async function loadOfficeHome(authorization: AuthorizationSnapshot): Promise<OfficeHomeModel> {
  if (!hasAnyAuthorizationArea(authorization)) return { kind: "no_areas" };

  try {
    const [orders, dashboard] = await Promise.all([getOperationalOrders(authorization), readTodayDashboard(authorization,getComplaints,getQuoteFollowupsForTodayAction)]);
    const common = {
      cacheLoginScope:await readCacheLoginScope(),
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

