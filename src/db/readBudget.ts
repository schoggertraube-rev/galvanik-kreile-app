import {AsyncLocalStorage} from 'node:async_hooks';
import {cache} from 'react';

type PageReadStationTiming={db_ms:number;acquire_ms:number;tx:number};
type PageReadQueryObservation={total:number;rights:number;pageSettings:number;shippingSettings:number;phases:Record<string,number>;db_ms:number;acquire_ms:number;tx:number;stations:Record<string,PageReadStationTiming>};
const requestQueryObservation=cache(():PageReadQueryObservation=>({total:0,rights:0,pageSettings:0,shippingSettings:0,phases:{},db_ms:0,acquire_ms:0,tx:0,stations:{}}));
const requestSourceWarnings=cache(()=>new Set<string>());
const queryPhases=new AsyncLocalStorage<string>();
/** Same RSC request only; contains counts, never SQL, parameters or identities. */
export function pageReadQueryObservation(){return budgets.getStore()?.queries??requestQueryObservation();}
function observationStation(budget:ReadBudget,phase=queryPhases.getStore()){
 return budget.kind==='authorization'?'authorization':phase&&diagnosticPhases.has(phase)?phase:'other';
}
/** Client-side elapsed SQL and native BEGIN acquisition, not DB-server CPU.
 * Diagnostics never change a query result, error, cancellation or deadline. */
function addReadTiming(budget:ReadBudget|undefined,key:keyof PageReadStationTiming,value:number,phase=queryPhases.getStore()){
 try{
  if(!budget||!Number.isFinite(value)||value<0)return;
  const observation=budget.queries,station=observationStation(budget,phase);
  const timings=observation.stations[station]??=( {db_ms:0,acquire_ms:0,tx:0} );
  observation[key]+=value;timings[key]+=value;
 }catch{console.error('[PAGE_READ_DIAGNOSTIC_FAILED]');}
}
function countNativeRead(statement:string,budget:ReadBudget,phase=queryPhases.getStore()){
 const counts=budget.queries;counts.total++;
 const station=observationStation(budget,phase);
 counts.phases[station]=(counts.phases[station]??0)+1;
 if(/^begin\b/i.test(statement.trim()))addReadTiming(budget,'tx',1,phase);
 const normalized=statement.replaceAll('"','').toLowerCase();
 if(budget.kind==='authorization'&&/\bfrom\s+(?:public\.)?app_users\b/.test(normalized)&&normalized.includes('app_user_rights'))counts.rights++;
 if(normalized.includes('as page_read_source')&&normalized.includes('company_settings'))counts.pageSettings++;
 if(normalized.includes('versand_dienst as service')&&normalized.includes('company_settings'))counts.shippingSettings++;
}
/** Native driver execution boundary. BEGIN is attributed after acquisition below:
 * a queued BEGIN's debug callback can still carry the previous borrower's context. */
export function observeNativePageReadQuery(_connection:number,statement:string){
 const budget=budgets.getStore();if(!budget||/^begin\b/i.test(statement.trim()))return;
 countNativeRead(statement,budget);
}
export function logPageReadQueryObservation(observation:PageReadQueryObservation){
 try{
  const stations=Object.fromEntries(Object.entries(observation.stations).map(([name,values])=>[name,{...values}]));
  console.info('[PAGE_READ_SQL]',JSON.stringify({route:'/',total:observation.total,rights:observation.rights,page_settings:observation.pageSettings,shipping_settings:observation.shippingSettings,phases:{...observation.phases},db_ms:observation.db_ms,acquire_ms:observation.acquire_ms,tx:observation.tx,stations}));
 }catch{console.error('[PAGE_READ_DIAGNOSTIC_FAILED]');}
}

/** Canonical startup/old-schema defaults; qualified company values override them.
 * The native settings contract checks the additive SQL defaults against these. */
export const DEFAULT_PAGE_READ_SETTINGS={
 queryTimeoutMs:10_000,invoiceMailBatchLimit:101,
 todayReadSource:'modell',todayRefreshBatchLimit:20,todayRefreshLeaseSeconds:30,todayShadowIntervalMs:60000,todayStalePollMs:1500,navPrefetchMaxAgeSeconds:60,
 authorizationTimeoutMs:1000,authorizationPoolSize:2,authorizationIdleTimeoutSeconds:300,
 get graphTimeoutMs(){return this.queryTimeoutMs;},
} as const;

/** Request-local only. Commands outside a page read retain their transaction contract. */
type ReadBudget={startedAt:number;deadline:number;cancel:Set<()=>void>;aborted:{value:boolean};queries:PageReadQueryObservation;sourceWarnings?:Set<string>;kind?:'authorization';prepareStatement?:(()=>Promise<unknown>);timeoutSetAt?:number;sourcesReady?:Promise<void>};
const budgets=new AsyncLocalStorage<ReadBudget>();
export const hasPageReadBudget=():boolean=>budgets.getStore()!==undefined;
/** The one request scope joins independent readers without suppressing unknown faults. */
export function warnOncePerPageRead(key:string,report:()=>void):void{
 const seen=budgets.getStore()?.sourceWarnings??requestSourceWarnings();
 if(seen.has(key))return;
 seen.add(key);report();
}
export function assertPageReadBudgetActive():void{
 const budget=budgets.getStore();
 if(budget&&(budget.aborted.value||Date.now()>=budget.deadline))throw new PageReadTimeout();
}
/** A lost projector lease cancels outstanding native reads in its own bounded
 * scope immediately. No request or unrelated transaction is affected. */
export function expirePageReadBudget():void{
 const budget=budgets.getStore();
 if(!budget)return;
 budget.aborted.value=true;
 budget.deadline=Math.min(budget.deadline,Date.now());
 for(const cancel of [...budget.cancel])cancel();
}
/** PL22.11.01:55 E0: sending is a command, never a page read. Only its
 * existing transport leaves this scope; the caller's deadline is restored. */
export function outsidePageReadBudget<T>(work:()=>Promise<T>):Promise<T>{
 return budgets.exit(work);
}
export const AUTHORIZATION_READ_TIMEOUT_MS=DEFAULT_PAGE_READ_SETTINGS.authorizationTimeoutMs;
export const isAuthorizationRead=():boolean=>budgets.getStore()?.kind==='authorization';
/** Start composition immediately, but acquire data connections only after the
 * existing company source configured this request. Authorization is independent. */
export function withPageReadSourcesReady<T>(ready:Promise<unknown>,work:()=>Promise<T>):Promise<T>{
 const parent=budgets.getStore();if(!parent)return work();
 const scope={...parent};
 scope.sourcesReady=ready.then(()=>{scope.deadline=parent.deadline;});
 return budgets.run(scope,work);
}
/** The canonical settings query must itself be able to open the data gate,
 * including when its request cache is first reached from a parallel reader. */
export function withPageReadSettingsSource<T>(work:()=>Promise<T>):Promise<T>{
 const parent=budgets.getStore();
 return parent?.sourcesReady?budgets.run({...parent,sourcesReady:undefined},work):work();
}
/** Separate short read scope; returning to a page restores its own deadline. */
export function withAuthorizationReadBudget<T>(work:()=>Promise<T>):Promise<T>{
 const startedAt=Date.now(),parent=budgets.getStore();
 return budgets.run({startedAt,deadline:Math.min(startedAt+AUTHORIZATION_READ_TIMEOUT_MS,parent?.deadline??Infinity),cancel:new Set(),aborted:{value:false},queries:parent?.queries??requestQueryObservation(),kind:'authorization'},async()=>await work());
}

export class PageReadTimeout extends Error {
  constructor(){super('PAGE_READ_TIMEOUT');this.name='PageReadTimeout';}
}

export function withPageReadBudget<T>(work:()=>Promise<T>,timeoutMs:number):Promise<T>{
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<=0)throw Error('PAGE_READ_TIMEOUT_SETTING_INVALID');
  if(budgets.getStore())return work();
  const startedAt=Date.now();
  // Drizzle queries are lazy thenables. Assimilate them inside the scope, not
  // later in the caller's await, or their SQL would miss the request budget.
  return budgets.run({startedAt,deadline:startedAt+timeoutMs,cancel:new Set(),aborted:{value:false},queries:requestQueryObservation(),sourceWarnings:requestSourceWarnings()},async()=>await work());
}

/** The trusted company setting changes only this read, never another request. */
export function configurePageReadBudget(timeoutMs:number):void{
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<=0)throw Error('PAGE_READ_TIMEOUT_SETTING_INVALID');
  const budget=budgets.getStore();
  if(budget)budget.deadline=budget.startedAt+timeoutMs;
}

function withinBudget<T>(work:()=>PromiseLike<T>,cancel?:()=>unknown):Promise<T>{
  const budget=budgets.getStore();
  if(!budget)return Promise.resolve(work());
  const remaining=budget.deadline-Date.now();
  if(budget.aborted.value||remaining<=0){
    // A lazy postgres-js query has not entered the pool yet. Do not cancel
    // and then start it: the driver would reserve a connection for a query
    // it refuses to execute. Reject before touching that pending query.
    return Promise.reject(new PageReadTimeout());
  }
  return new Promise<T>((resolve,reject)=>{
    let settled=false;
    const stop=()=>{if(!settled){
      settled=true;
      // Keep the native transaction reserved until its cancellation transport
      // has drained. Otherwise a late CancelRequest can cancel ROLLBACK or the
      // next BEGIN and leave the sole connection reserved indefinitely.
      try{Promise.resolve(cancel?.()).then(()=>reject(new PageReadTimeout()),()=>reject(new PageReadTimeout()));}
      catch{reject(new PageReadTimeout());}
    }};
    const timer=setTimeout(stop,remaining);
    budget.cancel.add(stop);
    const finish=(callback:()=>void)=>{
      clearTimeout(timer);budget.cancel.delete(stop);
      if(!settled){settled=true;callback();}
    };
    // Observe late rejection as well: cancellation must not create an unhandled error.
    Promise.resolve().then(work).then(value=>finish(()=>resolve(value)),error=>finish(()=>reject(error)));
  });
}

type QueryLike=PromiseLike<unknown>&{cancel:()=>void};
/** postgres-js Query.cancel discards its canceller's acknowledgement promise.
 * Invoke that same installed driver's canceller exactly once and retain it for
 * cleanup; adapters exposing only cancel keep their existing boundary. */
function cancelNativeQuery(query:QueryLike):unknown{
 const native=query as QueryLike&{canceller?:((query:QueryLike)=>unknown)|null};
 const cancel=native.canceller;
 if(typeof cancel!=='function')return query.cancel();
 const pending=cancel(query);native.canceller=null;return pending;
}
function boundedQuery<T extends QueryLike>(query:T):T{
  if(!budgets.getStore())return query;
  let pending:Promise<unknown>|undefined;
  const start=()=>pending??=(async()=>{
    await budgets.getStore()?.sourcesReady;
    const store=budgets.getStore(),prepare=store?.prepareStatement;
    if(!store||!prepare){
      const at=Date.now(),phase=queryPhases.getStore();
      try{return await withinBudget(()=>query,()=>cancelNativeQuery(query));}
      finally{addReadTiming(store,'db_ms',Math.max(0,Date.now()-at),phase);}
    }
    if(store.timeoutSetAt===undefined||Date.now()-store.timeoutSetAt>=250){
      const preparedAt=Date.now();await prepare();store.timeoutSetAt=Date.now();
      if(Date.now()-preparedAt>=250)logPageReadPhase('db.prepare',preparedAt);
    }
    const queryAt=Date.now(),phase=queryPhases.getStore();
    try{const result=await withinBudget(()=>query,()=>cancelNativeQuery(query));if(Date.now()-queryAt>=250)logPageReadPhase('db.query',queryAt);return result;}
    catch(error){logPageReadPhase('db.query',queryAt,{failed:1},error);if(error&&typeof error==='object'&&'code'in error&&error.code==='57014')throw new PageReadTimeout();throw error;}
    finally{addReadTiming(store,'db_ms',Math.max(0,Date.now()-queryAt),phase);}
  })();
  const wrapped:T=new Proxy(query,{
    get(target,key){
      if(key==='then')return start().then.bind(start());
      if(key==='catch')return start().catch.bind(start());
      if(key==='finally')return start().finally.bind(start());
      if(key==='execute')return ()=>{void start().catch(()=>undefined);return wrapped;};
      const value=Reflect.get(target,key,target);
      if(typeof value!=='function')return value;
      return (...args:unknown[])=>{
        const result=Reflect.apply(value,target,args);
        return result===target?wrapped:result;
      };
    },
  });
  return wrapped;
}

/** Decorate the existing postgres-js client, including transaction/savepoint
 * clients. A timeout cancels the real queued/active query; it is not just a UI race.
 * No query text, parameter or credential enters this metadata-only scope. */
export function withPageReadQueryLimits<T extends object>(client:T):T{
  return new Proxy(client,{
    apply(target,thisArg,args){
      const result=Reflect.apply(target as (...args:unknown[])=>unknown,thisArg,args);
      return isQuery(result)?boundedQuery(result):result;
    },
    get(target,key){
      const value=Reflect.get(target,key,target);
      if(typeof value!=='function')return value;
      if(key==='begin'||key==='savepoint')return (...args:unknown[])=>{
        const callbackIndex=args.findLastIndex(arg=>typeof arg==='function');
        if(callbackIndex<0)return Reflect.apply(value,target,args);
        const callback=args[callbackIndex] as (sql:object)=>unknown;
        const run=()=>{
        const acquiringAt=Date.now();
        const budget=budgets.getStore();
        const acquiringPhase=queryPhases.getStore();
        if(!budget)return Reflect.apply(value,target,args);
        if(budget.aborted.value||Date.now()>=budget.deadline)return Promise.reject(new PageReadTimeout());
        return new Promise((resolve,reject)=>{
          // Bound pool acquisition, but once acquired let the native driver
          // finish cancellation/rollback before releasing this transaction.
          // An outer race at that point could reuse a connection too early.
          const timer=setTimeout(()=>reject(new PageReadTimeout()),budget.deadline-Date.now());
          args[callbackIndex]=async(sql:object)=>{
            clearTimeout(timer);
            if(key==='begin'){
              countNativeRead('BEGIN',budget,acquiringPhase);
              addReadTiming(budget,'acquire_ms',Math.max(0,Date.now()-acquiringAt),acquiringPhase);
            }
            if(key==='begin'&&Date.now()-acquiringAt>=250){
              // Only non-secret transport metadata from the actual driver.
              // CLI env-run can prefer a local file; it cannot prove this port.
              const options=Object.getOwnPropertyDescriptor(target,'options')?.value as {port?:unknown;host?:unknown}|undefined;
              const ports=Array.isArray(options?.port)?options.port:[options?.port];
              const hosts=Array.isArray(options?.host)?options.host:[options?.host];
              const port=ports.length===1&&Number.isSafeInteger(ports[0])&&ports[0]>0&&ports[0]<=65535?ports[0]:undefined;
              const pooler=hosts.length>0&&hosts.every(host=>typeof host==='string')?hosts.every(host=>(host as string).endsWith('.pooler.supabase.com')):undefined;
              logPageReadPhase('db.acquire',acquiringAt,{...(port===undefined?{driver_port_unknown:1}:{driver_port:port}),...(pooler===undefined?{driver_host_unknown:1}:{driver_pooler:pooler?1:0})});
            }
            const remaining=budget.deadline-Date.now();
            if(budget.aborted.value||remaining<=0)throw new PageReadTimeout();
            // PostgreSQL is the second cancellation boundary: even if the
            // separate native cancel connection fails, this read cannot run
            // indefinitely. Transaction-local state never leaks into the pool.
            const native=sql as {unsafe:(query:string,parameters:string[])=>QueryLike};
            // A savepoint inherits its transaction's server timeout. Every
            // actual nested query is prepared below with its remaining time;
            // do not spend an extra roundtrip on an otherwise empty savepoint.
            if(key==='begin'){
              const setting=native.unsafe("SELECT set_config('statement_timeout',$1,true)",[String(remaining)]);
              const at=Date.now();
              try{await withinBudget(()=>setting,()=>cancelNativeQuery(setting));}
              finally{addReadTiming(budget,'db_ms',Math.max(0,Date.now()-at),acquiringPhase);}
            }
            const prepareStatement=async()=>{
              const left=budget.deadline-Date.now();if(budget.aborted.value||left<=0)throw new PageReadTimeout();
              const at=Date.now(),phase=queryPhases.getStore();
              try{return await withinBudget(()=>native.unsafe("SELECT set_config('statement_timeout',$1,true)",[String(left)]));}
              finally{addReadTiming(budget,'db_ms',Math.max(0,Date.now()-at),phase);}
            };
            const timeoutSetAt=key==='begin'?Date.now():budget.timeoutSetAt;
            return budgets.run({...budget,prepareStatement,timeoutSetAt},()=>callback(withPageReadQueryLimits(sql)));
          };
          Promise.resolve(Reflect.apply(value,target,args)).then(result=>{clearTimeout(timer);resolve(result);},error=>{clearTimeout(timer);reject(error&&typeof error==='object'&&'code'in error&&error.code==='57014'?new PageReadTimeout():error);});
        });
        };
        const ready=budgets.getStore()?.sourcesReady;
        return ready?ready.then(run):run();
      };
      return (...args:unknown[])=>{
        const result=Reflect.apply(value,target,args);
        return isQuery(result)?boundedQuery(result):result;
      };
    },
  });
}
function isQuery(value:unknown):value is QueryLike{
  return value!==null&&typeof value==='object'&&'then'in value&&'cancel'in value&&typeof value.cancel==='function';
}

/** Keep the same request deadline at the existing provider boundary. The native
 * signal also aborts a slow body after headers arrive; no eager buffering and
 * no change to unscoped sends or caller cancellation. */
export function pageReadFetchPort(fetchPort:typeof fetch):typeof fetch{
 return (input,init)=>{
  const budget=budgets.getStore();
  if(!budget)return fetchPort(input,init);
  const read=()=>{
  const remaining=budget.deadline-Date.now();
  if(budget.aborted.value||remaining<=0)return Promise.reject(new PageReadTimeout());
  const original=init?.signal??(input instanceof Request?input.signal:undefined);
  const deadline=AbortSignal.timeout(remaining);
  const signal=original?AbortSignal.any([original,deadline]):deadline;
  return withinBudget(()=>fetchPort(input,{...init,signal}));
  };
  return budget.sourcesReady?budget.sourcesReady.then(read):read();
 };
}

/** PL20.11.21:21: metadata-only diagnostics in the existing request log.
 * Never serialize an error, SQL, values, actor, body or credential. */
const diagnosticPhases=new Set(["home.total", "home.settings", "home.dashboard", "home.orders", "orders.list.source", "orders.list.cards", "orders.list.dispatch", "today.orders", "today.graph", "today.support", "today.complaints", "today.followups", "today.company", "today.initial", "today.batch", "today.versions", "today.quotes", "today.quote_card", "today.tasks", "today.responsibility", "today.source", "today.model", "cards.import", "cards.outer_error", "cards.denied", "cards.snapshot", "cards.one_snapshot", "cards.fallback", "cards.qualify", "cards.model", "action.settings", "action.company", "action.auth", "action.cards", "action.evidence", "action.shipping", "action.informed", "action.payment", "action.shipment", "action.appointment", "action.model", "db.acquire", "db.prepare", "db.query", "auth.candidates", "auth.tx", "auth.bcrypt", "auth.last_seen", "today.model.read", "today.model.compose", "today.refresh", "rsc.bytes"]);
const diagnosticReasons=new Set(["CUSTOMER_CREDIT_TASK_PORT_MISSING", "EXTRA_WORK_CATALOG_INVALID", "EXTRA_WORK_CURRENT_RATE_AMBIGUOUS", "EXTRA_WORK_CURRENT_RATE_INVALID", "INVOICE_AMOUNT_UNSAFE", "INVOICE_BASE_LINES_INVALID", "INVOICE_BASE_LINES_MISSING", "INVOICE_BASE_LINE_INTEGRITY_INVALID", "INVOICE_BASE_LINE_MASTER_DATA_INVALID", "INVOICE_BASE_LINE_SHAPE_INVALID", "INVOICE_CANCELLATION_PDF_RENDER_FAILED", "INVOICE_CANCELLATION_PDF_SIZE_INVALID", "INVOICE_CANCEL_COLLECTION_CHANGED", "INVOICE_CANCEL_COLLECTION_IDENTITY_INVALID", "INVOICE_CANCEL_COLLECTION_RELEASE_INCOMPLETE", "INVOICE_CANCEL_EVENT_INSERT_FAILED", "INVOICE_CANCEL_NUMBER_ALLOCATION_FAILED", "INVOICE_CANCEL_ORDER_INTEGRITY_INVALID", "INVOICE_CANCEL_ORIGINAL_PDF_INVALID", "INVOICE_CANCEL_PAYMENT_SOURCE_MISSING", "INVOICE_CANCEL_RECEIPT_INVALID", "INVOICE_CANCEL_RECEIPT_MISMATCH", "INVOICE_CANCEL_RECEIPT_MISSING", "INVOICE_CANCEL_RECEIPT_NUMBER_INVALID", "INVOICE_CANCEL_SINGLE_IDENTITY_INVALID", "INVOICE_CANCEL_SOURCE_INVALID", "INVOICE_CANCEL_TIME_UNAVAILABLE", "INVOICE_CANCEL_UPDATE_FAILED", "INVOICE_COLLECTION_CUSTOMER_CHANGED", "INVOICE_COLLECTION_EMPTY", "INVOICE_COLLECTION_MARK_FAILED", "INVOICE_COLLECTION_MEMBERSHIP_INVALID", "INVOICE_COLLECTION_MEMBER_SOURCE_INVALID", "INVOICE_COLLECTION_MONTH_SOURCE_INVALID", "INVOICE_COLLECTION_NOT_DUE", "INVOICE_COLLECTION_ORIGINAL_SOURCE_INVALID", "INVOICE_COLLECTION_PREPARATION_INVALID", "INVOICE_COLLECTION_RECEIPT_INVALID", "INVOICE_COLLECTION_RECEIPT_MISMATCH", "INVOICE_COLLECTION_RECEIPT_MISSING", "INVOICE_COLLECTION_RECEIPT_SOURCE_INVALID", "INVOICE_COLLECTION_REPLAY_AMBIGUOUS", "INVOICE_COLLECTION_ROUTING_IDENTITY_INVALID", "INVOICE_COLLECTION_ROUTING_ORIGINAL_INVALID", "INVOICE_COLLECTION_ROUTING_PHYSICAL_SOURCE_CHANGED", "INVOICE_COLLECTION_ROUTING_READBACK_FAILED", "INVOICE_COLLECTION_ROUTING_RECEIPT_INVALID", "INVOICE_COLLECTION_ROUTING_SOURCE_INCOMPLETE", "INVOICE_COLLECTION_ROUTING_TASK_PORT_MISSING", "INVOICE_COLLECTION_ROUTING_TERMS_MISSING", "INVOICE_COLLECTION_SHIPMENT_ORIGINS_MISSING", "INVOICE_COLLECTION_SHIPMENT_SOURCE_CONFLICT", "INVOICE_COLLECTION_SOURCE_INVALID", "INVOICE_CUSTOMER_TERMS_PORT_MISSING", "INVOICE_DATE_INVALID", "INVOICE_EVENT_INSERT_FAILED", "INVOICE_EXTRA_WORK_LINES_INVALID", "INVOICE_EXTRA_WORK_LINE_INTEGRITY_INVALID", "INVOICE_EXTRA_WORK_LINE_SHAPE_INVALID", "INVOICE_INSERT_FAILED", "INVOICE_LINE_COUNT_MISMATCH", "INVOICE_LINE_RATE_REQUIRED", "INVOICE_LINE_TOTAL_MISMATCH", "INVOICE_NUMBER_ALLOCATION_FAILED", "INVOICE_PAYMENT_INITIALIZATION_READBACK_INVALID", "INVOICE_PDF_RENDER_FAILED", "INVOICE_PDF_SIZE_INVALID", "INVOICE_PREPARATION_SOURCE_INVALID", "INVOICE_QUOTE_BASE_SOURCE_INVALID", "INVOICE_QUOTE_EXTRA_WORK_SOURCE_INVALID", "INVOICE_RECEIPT_INTENT_MISMATCH", "INVOICE_RECEIPT_INVALID", "INVOICE_RECEIPT_KIND_INVALID", "INVOICE_RECEIPT_MISMATCH", "INVOICE_RECEIPT_MISSING", "INVOICE_RECEIPT_SOURCE_INVALID", "INVOICE_REISSUE_ACTIVE_ORIGINAL_CHANGED", "INVOICE_REISSUE_CANCELLATION_AMBIGUOUS", "INVOICE_REISSUE_COLLECTION_FORBIDDEN", "INVOICE_REISSUE_CREDIT_NOT_PROVEN", "INVOICE_REISSUE_GOODS_SOURCE_INVALID", "INVOICE_REISSUE_HANDOVER_SOURCE_INVALID", "INVOICE_REISSUE_INTENT_INVALID", "INVOICE_REISSUE_MONEY_REQUIRED", "INVOICE_REISSUE_ORDER_CHANGED", "INVOICE_REISSUE_ORDER_SOURCE_INVALID", "INVOICE_REISSUE_ORIGINAL_INVALID", "INVOICE_REISSUE_RECEIPT_INVALID", "INVOICE_REISSUE_RECEIPT_MISSING", "INVOICE_REISSUE_REPLACEMENT_AMBIGUOUS", "INVOICE_REISSUE_REPLACEMENT_SOURCE_INVALID", "INVOICE_REISSUE_SOURCE_MISSING", "INVOICE_REISSUE_TASK_NOT_AUTHORIZED", "INVOICE_REISSUE_TASK_NOT_REPAIRED", "INVOICE_REISSUE_TASK_PORT_MISSING", "INVOICE_SHIPPING_ALLOCATION_AMBIGUOUS", "INVOICE_SHIPPING_GROUP_SOURCE_INVALID", "INVOICE_SHIPPING_KIND_SOURCE_MISSING", "INVOICE_SHIPPING_ORIGINAL_INVALID", "INVOICE_SHIPPING_ORIGINAL_RECEIPT_INVALID", "INVOICE_SHIPPING_ORIGINAL_RECEIPT_MISSING", "INVOICE_SHIPPING_ORIGIN_PDF_INVALID", "INVOICE_SHIPPING_ORIGIN_RECEIPT_INVALID", "INVOICE_SHIPPING_ORIGIN_RECEIPT_MISSING", "INVOICE_SHIPPING_QUOTE_SOURCE_MISSING", "INVOICE_SHIPPING_SETTINGS_PORT_MISSING", "INVOICE_SHIPPING_SETTINGS_SOURCE_MISSING", "INVOICE_SNAPSHOT_BASE_LINE_INVALID", "INVOICE_SNAPSHOT_BASE_LINE_SHAPE_INVALID", "INVOICE_SNAPSHOT_BASE_UNIT_SOURCE_INVALID", "INVOICE_SNAPSHOT_CUSTOMER_SHAPE_INVALID", "INVOICE_SNAPSHOT_EXTRA_WORK_LINE_INVALID", "INVOICE_SNAPSHOT_EXTRA_WORK_LINE_SHAPE_INVALID", "INVOICE_SNAPSHOT_INTEGRITY_INVALID", "INVOICE_SNAPSHOT_LINE_INVALID", "INVOICE_SNAPSHOT_LINE_TYPE_INVALID", "INVOICE_SNAPSHOT_ORDER_SHAPE_INVALID", "INVOICE_SNAPSHOT_SELLER_SHAPE_INVALID", "INVOICE_SNAPSHOT_SHAPE_INVALID", "INVOICE_SNAPSHOT_SHIPPING_KIND_INVALID", "INVOICE_SNAPSHOT_SHIPPING_RATE_INVALID", "INVOICE_SNAPSHOT_SHIPPING_SHAPE_INVALID", "INVOICE_SNAPSHOT_TOTALS_SHAPE_INVALID", "INVOICE_SNAPSHOT_TYPE_INVALID", "INVOICE_SOURCE_INTEGRITY_INVALID", "INVOICE_TIME_INVALID", "INVOICE_TIME_UNAVAILABLE", "ORDER_CARD_ASSIGNMENT_AMBIGUOUS", "ORDER_CARD_ASSIGNMENT_INVALID", "ORDER_CARD_ASSIGNMENT_OPTION_INVALID", "ORDER_CARD_CONTENT_EVENT_INVALID", "ORDER_CARD_CONTENT_READBACK_INVALID", "ORDER_CARD_CURRENT_ITEMS_INVALID", "ORDER_CARD_CURRENT_ITEM_INVALID", "ORDER_CARD_CUSTOMER_INVALID", "ORDER_CARD_DUE_DATE_CHANGE_INVALID", "ORDER_CARD_EXTRA_WORK_INVALID", "ORDER_CARD_EXTRA_WORK_ITEM_INVALID", "ORDER_CARD_EXTRA_WORK_ORDER_INVALID", "ORDER_CARD_FREEZE_AMBIGUOUS", "ORDER_CARD_FREEZE_INVALID", "ORDER_CARD_FREEZE_STATE_INVALID", "ORDER_CARD_HANDOVER_EVENT_INVALID", "ORDER_CARD_INTAKE_ITEMS_INVALID", "ORDER_CARD_INTAKE_ITEM_INVALID", "ORDER_CARD_INTAKE_ITEM_SHAPE_INVALID", "ORDER_CARD_INTAKE_RECEIPT_INVALID", "ORDER_CARD_INVOICE_PRICE_RECEIPT_INVALID", "ORDER_CARD_ITEM_DUPLICATE", "ORDER_CARD_LABEL_PRINT_INVALID", "ORDER_CARD_MANUAL_HANDOVER_INVALID", "ORDER_CARD_ORIGIN_INVALID", "ORDER_CARD_QUEUE_INVALID", "ORDER_CARD_QUOTE_CALCULATION_INVALID", "ORDER_CARD_QUOTE_PRICE_INVALID", "ORDER_CARD_REWORK_LINK_INVALID", "ORDER_CARD_TIME_INVALID", "ORDER_POSITION_SURFACE_KEY_UNKNOWN", "PAGE_READ_TIMEOUT", "QUOTE_COMMERCIAL_TERMS_CHANGED_DURING_INVOICE", "QUOTE_PRICE_INVALID", "QUOTE_VAT_SOURCE_AMBIGUOUS", "SHIPPING_PROPOSAL_AMOUNT_INVALID", "SHIPPING_PROPOSAL_FREEZE_SOURCE_INVALID", "SHIPPING_PROPOSAL_INVOICE_SOURCE_INVALID", "SHIPPING_PROPOSAL_INVOICE_SOURCE_MISSING", "SHIPPING_PROPOSAL_MANUAL_HANDOVER_MISSING", "SHIPPING_PROPOSAL_MANUAL_HANDOVER_STALE", "SHIPPING_PROPOSAL_ORDER_SOURCE_INVALID", "SHIPPING_PROPOSAL_ORIGINAL_AMBIGUOUS", "SHIPPING_PROPOSAL_SETTINGS_SOURCE_MISSING"]);
const diagnosticCodes=new Set(['22023','22P02','42501','57014','42P01','42703','53300','08001','08006','25P02','25006','40001','40P01','55P03','ECONNREFUSED','ECONNRESET','ENOTFOUND','ETIMEDOUT','CONNECT_TIMEOUT','CONNECTION_CLOSED']);
const diagnosticNames=new Set(['Error','PostgresError','DrizzleQueryError','PageReadTimeout','TypeError','RangeError']);
export function logPageReadPhase(phase:string,startedAt:number,counts:Readonly<Record<string,number>>={},error?:unknown):void{
 try{
  if(!diagnosticPhases.has(phase)||!Number.isFinite(startedAt))return;
  const safeCounts=Object.fromEntries(Object.entries(counts).filter(([key,value])=>/^[a-z_]{1,40}$/.test(key)&&Number.isSafeInteger(value)&&value>=0));
  const codes=new Set<string>(),names=new Set<string>(),reasons=new Set<string>();
  try{
  for(let current:unknown=error,depth=0;current&&typeof current==='object'&&depth<5;depth++){
   const code:unknown=Object.getOwnPropertyDescriptor(current,'code')?.value;
   const message:unknown=Object.getOwnPropertyDescriptor(current,'message')?.value;
   const name:unknown=current instanceof Error?current.name:undefined;
   if(typeof code==='string'&&(diagnosticCodes.has(code)||name==='PostgresError'&&/^[0-9A-Z]{5}$/.test(code)))codes.add(code);
   if(typeof message==='string'&&diagnosticReasons.has(message))reasons.add(message);
   if(typeof name==='string'&&diagnosticNames.has(name))names.add(name);
   current=Object.getOwnPropertyDescriptor(current,'cause')?.value;
  }
  }catch{safeCounts.error_metadata_failed=1;}
  const budget=budgets.getStore(),now=Date.now();
  console.info('[PAGE_READ_PHASE]',JSON.stringify({phase,durationMs:Math.max(0,now-startedAt),offsetMs:budget?startedAt-budget.startedAt:null,counts:safeCounts,codes:[...codes],reasons:[...reasons],names:[...names],budgetKind:budget?.kind??(budget?'page':'unscoped'),remainingMs:budget?Math.max(0,budget.deadline-now):null}));
 }catch{console.error('[PAGE_READ_DIAGNOSTIC_FAILED]');}
}
export async function withPageReadPhase<T>(phase:string,work:()=>PromiseLike<T>|T,resultCounts?:(value:T)=>Record<string,number>):Promise<T>{
 const started=Date.now();let value:T;
 // Technical savepoint timing belongs to its caller's SQL station. Assimilate
 // lazy queries inside the diagnostic context without cloning their budget.
 const station=phase==='today.source'?(queryPhases.getStore()??phase):phase;
 try{value=await queryPhases.run(station,async()=>await work());}
 catch(error){logPageReadPhase(phase,started,{failed:1},error);throw error;}
 let counts:Record<string,number>={};
 try{
  if(Array.isArray(value))counts={rows:value.length};
  else if(value instanceof Map)counts={rows:value.size};
  else if(value&&typeof value==='object'){
   const code:unknown=Object.getOwnPropertyDescriptor(value,'code')?.value;
   if(typeof code==='string')counts=code==='NOT_APPLICABLE'?{not_applicable:1}:{ok:code==='OK'?1:0,failed:code==='OK'?0:1};
   else{const ok:unknown=Object.getOwnPropertyDescriptor(value,'ok')?.value;if(typeof ok==='boolean')counts={ok:ok?1:0,failed:ok?0:1};}
  }
 }catch{counts={metadata_failed:1};}
 if(resultCounts){try{counts=resultCounts(value);}catch{counts={metadata_failed:1};}}
 logPageReadPhase(phase,started,counts);return value;
}
