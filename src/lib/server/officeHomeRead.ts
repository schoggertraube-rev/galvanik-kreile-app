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
import {withPageReadBudget,withPageReadPhase} from '@/db/readBudget';
import {readModelTodayHome} from '@/app/actions/todayModel.actions';
import {scheduleTodayProjection} from './todayProjectionSchedule';
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
  return withPageReadBudget(()=>withPageReadPhase('home.total',()=>loadOfficeHomeWithinBudget(authorization)),DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs);
}
async function loadOfficeHomeWithinBudget(authorization: AuthorizationSnapshot): Promise<OfficeHomeModel> {
  if (!hasAnyAuthorizationArea(authorization)) return { kind: "no_areas" };

  try {
    const now=new Date(),modeled=await readModelTodayHome(authorization,now);
    let orderSource:{code:'OK';orders:OperationalOrder[]}|{code:'SOURCE_INCOMPLETE'};
    let dashboard:Awaited<ReturnType<typeof readTodayDashboard>>;
    let modelRead:{source:'modell'|'live';pending:boolean;incomplete:boolean;pollMs:number;rebuild:boolean;revision?:string};
    if(modeled.code==='OK'){
      dashboard=modeled.dashboard;
      orderSource=modeled.operationalSource.code==='OK'?{code:'OK',orders:modeled.operationalSource.data}:{code:'SOURCE_INCOMPLETE'};
      modelRead={source:'modell',pending:modeled.pending,incomplete:modeled.incomplete,pollMs:modeled.settings.today.todayStalePollMs,rebuild:modeled.needsRebuild,revision:modeled.sourceRevision};
      if(modeled.needsRebuild||modeled.pending)await scheduleTodayProjection([authorization.tenantId],modeled.needsRebuild?'rebuild':'refresh');
    }else{
      // Only an explicitly selected live path or a known empty model uses the
      // existing whole live collector. Individual disqualified model rows use
      // only their canonical live readers inside the model collection.
      const ordersRead=withPageReadPhase('home.orders',()=>getOperationalOrders(authorization,{purpose:'today'}));
      [orderSource,dashboard]=await Promise.all([ordersRead.then(orders=>({code:'OK' as const,orders})).catch(()=>({code:'SOURCE_INCOMPLETE' as const})),withPageReadPhase('home.dashboard',()=>readTodayDashboard(authorization,getComplaints,getQuoteFollowupsForTodayAction,now,ordersRead))]);
      modelRead={source:modeled.code==='LIVE'?'live':'modell',pending:modeled.code==='EMPTY',incomplete:false,pollMs:modeled.settings.today.todayStalePollMs,rebuild:modeled.code==='EMPTY'};
      if(modeled.code==='EMPTY')await scheduleTodayProjection([authorization.tenantId],'rebuild');
    }
    if(modeled.settings.page===null)dashboard.datenluecken=[...(dashboard.datenluecken??[]),'PAGE_READ_SETTINGS_SOURCE'];
    const common = {
      cacheLoginScope:await readCacheLoginScope(),
      role: authorization.role,
      canCreateOrder: hasAuthorizationArea(authorization, "eingang"),
      canWorkOrders: hasAuthorizationArea(authorization, "auftraege"),
      canDelegate: hasAuthorizationArea(authorization, "auftraege"),
      dashboard,
      modelRead,
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
