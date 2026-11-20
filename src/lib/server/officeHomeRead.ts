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
import {withPageReadBudget,configurePageReadBudget} from '@/db/readBudget';
import {readPageReadSettingsAction} from '@/app/actions/orders.actions';
import {DEFAULT_PAGE_READ_SETTINGS} from '@/db/readBudget';

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
  return withPageReadBudget(()=>loadOfficeHomeWithinBudget(authorization),DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs);
}
async function loadOfficeHomeWithinBudget(authorization: AuthorizationSnapshot): Promise<OfficeHomeModel> {
  if (!hasAnyAuthorizationArea(authorization)) return { kind: "no_areas" };

  try {
    let settingsIncomplete=false;
    try{const source=await readPageReadSettingsAction();if(source.code==='OK')configurePageReadBudget(source.settings.queryTimeoutMs);else settingsIncomplete=true;}
    catch{settingsIncomplete=true;}
    // One request, one operational source; the Today composition consumes this
    // exact promise rather than issuing the same full-list query a second time.
    const ordersRead=getOperationalOrders(authorization,{purpose:'today'});
    const [orderSource, dashboard] = await Promise.all([ordersRead.then(orders=>({code:'OK' as const,orders})).catch(()=>({code:'SOURCE_INCOMPLETE' as const})), readTodayDashboard(authorization,getComplaints,getQuoteFollowupsForTodayAction,new Date(),ordersRead)]);
    if(settingsIncomplete)dashboard.datenluecken=[...(dashboard.datenluecken??[]),'PAGE_READ_SETTINGS_SOURCE'];
    const common = {
      cacheLoginScope:await readCacheLoginScope(),
      role: authorization.role,
      canCreateOrder: hasAuthorizationArea(authorization, "eingang"),
      canWorkOrders: hasAuthorizationArea(authorization, "auftraege"),
      canDelegate: hasAuthorizationArea(authorization, "auftraege"),
      dashboard,
    } as const;
    if(orderSource.code!=='OK')return {kind:'partial',projection:null,...common};
    const projection = buildOrdersHomeProjection(orderSource.orders.map(toHomeSource), new Date().toISOString());
    return orderSource.orders.length === 0
      ? { kind: "empty", ...common, projection }
      : { kind: "data", ...common, projection };
  } catch(error) {
    console.error('[OFFICE_HOME_READ_FAILED]',{name:error instanceof Error?error.name:'UnknownError',at:error instanceof Error?error.stack?.split('\n').slice(1,4):undefined});
    return { kind: "error", message: "Die aktuellen Auftragsdaten konnten nicht sicher geladen werden." };
  }
}
