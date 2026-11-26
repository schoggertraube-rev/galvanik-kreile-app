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
import {readOfficeHomeModelAction,type TodayModelReader} from '@/app/actions/orders.actions';
import type {TodayHomePart,TodayHomePartResult} from '@/components/home/OfficeHomeClient';
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

export async function loadOfficeHome(authorization: AuthorizationSnapshot,deferLive=false,readModel?:TodayModelReader): Promise<OfficeHomeModel> {
  if(!readModel)return readOfficeHomeModelAction({deferLive});
  return withPageReadBudget(()=>withPageReadPhase('home.total',()=>loadOfficeHomeWithinBudget(authorization,deferLive,readModel)),DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs);
}
async function loadOfficeHomeWithinBudget(authorization: AuthorizationSnapshot,deferLive:boolean,readModel:TodayModelReader): Promise<OfficeHomeModel> {
  if (!hasAnyAuthorizationArea(authorization)) return { kind: "no_areas" };

  try {
    const now=new Date();
    const [modeled,cacheLoginScope]=await Promise.all([readModel(authorization,now,deferLive),readCacheLoginScope()]);
    let orderSource:{code:'OK';orders:OperationalOrder[]}|{code:'SOURCE_INCOMPLETE'};
    let dashboard:Awaited<ReturnType<typeof readTodayDashboard>>;
    let modelRead:{source:'modell'|'live';pending:boolean;incomplete:boolean;pollMs:number;maxPollMs:number;rebuild:boolean;revision?:string;revisions?:Record<string,string>};
    if(modeled.code==='OK'){
      dashboard=modeled.dashboard;
      orderSource=modeled.operationalSource.code==='OK'?{code:'OK',orders:modeled.operationalSource.data}:{code:'SOURCE_INCOMPLETE'};
      modelRead={source:'modell',pending:modeled.pending,incomplete:modeled.incomplete,pollMs:modeled.settings.today.todayStalePollMs,maxPollMs:modeled.settings.today.todayShadowIntervalMs,rebuild:modeled.needsRebuild,revision:modeled.sourceRevision,revisions:modeled.sourceRevisions};
    }else{
      // Only an explicitly selected live path or a known empty model uses the
      // existing whole live collector. Individual disqualified model rows use
      // only their canonical live readers inside the model collection.
      const ordersRead=withPageReadPhase('home.orders',()=>getOperationalOrders(authorization,{purpose:'today'}));
      [orderSource,dashboard]=await Promise.all([ordersRead.then(orders=>({code:'OK' as const,orders})).catch(()=>({code:'SOURCE_INCOMPLETE' as const})),withPageReadPhase('home.dashboard',()=>readTodayDashboard(authorization,getComplaints,getQuoteFollowupsForTodayAction,now,ordersRead,modeled.tagQuellenPorts))]);
      modelRead={source:modeled.code==='LIVE'?'live':'modell',pending:modeled.code==='EMPTY',incomplete:false,pollMs:modeled.settings.today.todayStalePollMs,maxPollMs:modeled.settings.today.todayShadowIntervalMs,rebuild:modeled.code==='EMPTY'};
    }
    if(modeled.settings.page===null)dashboard.datenluecken=[...(dashboard.datenluecken??[]),'PAGE_READ_SETTINGS_SOURCE'];
    const common = {
      cacheLoginScope,
      role: authorization.role,
      canCreateOrder: hasAuthorizationArea(authorization, "eingang"),
      canWorkOrders: hasAuthorizationArea(authorization, "auftraege"),
      canDelegate: hasAuthorizationArea(authorization, "auftraege"),
      dashboard,
      modelRead,
    } as const;
    if(orderSource.code!=='OK')return {kind:'partial',projection:null,...common};
    let projection:ReturnType<typeof buildOrdersHomeProjection>;
    try {
      projection=buildOrdersHomeProjection(orderSource.orders.map(toHomeSource),new Date().toISOString());
    } catch(error) {
      if(!(error instanceof Error)||!['ORDERS_HOME_SOURCE_INVALID','ORDERS_HOME_PROJECTION_INVALID'].includes(error.message))throw error;
      // A legacy/incomplete order cannot form this projection. Preserve the
      // independently qualified Today dashboard; do not invent a due date.
      dashboard.datenluecken=[...(dashboard.datenluecken??[]),'ORDERS_HOME_PROJECTION_SOURCE'];
      modelRead.incomplete=true;
      return {kind:'partial',projection:null,...common};
    }
    return orderSource.orders.length === 0
      ? { kind: "empty", ...common, projection }
      : { kind: "data", ...common, projection };
  } catch(error) {
    console.error('[OFFICE_HOME_READ_FAILED]',{name:error instanceof Error?error.name:'UnknownError',at:error instanceof Error?error.stack?.split('\n').slice(1,4):undefined});
    return { kind: "error", message: "Die aktuellen Auftragsdaten konnten nicht sicher geladen werden." };
  }
}

/** Same sanitized, actor-bound primary snapshot; no source reread for these
 * supplementary projections and no private union/model payload in an Action. */
export function todayHomePartFromModel(model:OfficeHomeModel,part:TodayHomePart):TodayHomePartResult{
 if(!('dashboard'in model))return {code:'SOURCE_INCOMPLETE',part};
 if(part==='notices')return {code:'OK',part,missing:[...(model.dashboard.datenluecken??[])]};
 if(part==='counts')return {code:model.dashboard.datenluecken?.length?'SOURCE_INCOMPLETE':'OK',part};
 return {code:'SOURCE_INCOMPLETE',part};
}
