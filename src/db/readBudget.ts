import {AsyncLocalStorage} from 'node:async_hooks';

/** Canonical startup/old-schema defaults; qualified company values override them.
 * The native settings contract checks the additive SQL defaults against these. */
export const DEFAULT_PAGE_READ_SETTINGS={queryTimeoutMs:10_000,invoiceMailBatchLimit:101} as const;

/** Request-local only. Commands outside a page read retain their transaction contract. */
type ReadBudget={startedAt:number;deadline:number;cancel:Set<()=>void>;kind?:'authorization';prepareStatement?:(()=>Promise<unknown>)};
const budgets=new AsyncLocalStorage<ReadBudget>();
export const hasPageReadBudget=():boolean=>budgets.getStore()!==undefined;
export const DEFAULT_CONNECTION_READ_SETTINGS={authorizationTimeoutMs:1000,authorizationPoolSize:2,authorizationIdleTimeoutSeconds:20,graphTimeoutMs:DEFAULT_PAGE_READ_SETTINGS.queryTimeoutMs} as const;
export const AUTHORIZATION_READ_TIMEOUT_MS=DEFAULT_CONNECTION_READ_SETTINGS.authorizationTimeoutMs;
export const isAuthorizationRead=():boolean=>budgets.getStore()?.kind==='authorization';
/** Separate short read scope; returning to a page restores its own deadline. */
export function withAuthorizationReadBudget<T>(work:()=>Promise<T>):Promise<T>{
 const startedAt=Date.now(),parent=budgets.getStore();
 return budgets.run({startedAt,deadline:Math.min(startedAt+AUTHORIZATION_READ_TIMEOUT_MS,parent?.deadline??Infinity),cancel:new Set(),kind:'authorization'},async()=>await work());
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
  return budgets.run({startedAt,deadline:startedAt+timeoutMs,cancel:new Set()},async()=>await work());
}

/** The trusted company setting changes only this read, never another request. */
export function configurePageReadBudget(timeoutMs:number):void{
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<=0)throw Error('PAGE_READ_TIMEOUT_SETTING_INVALID');
  const budget=budgets.getStore();
  if(budget)budget.deadline=budget.startedAt+timeoutMs;
}

function withinBudget<T>(work:()=>PromiseLike<T>,cancel?:()=>void):Promise<T>{
  const budget=budgets.getStore();
  if(!budget)return Promise.resolve(work());
  const remaining=budget.deadline-Date.now();
  if(remaining<=0){
    // A lazy postgres-js query has not entered the pool yet. Do not cancel
    // and then start it: the driver would reserve a connection for a query
    // it refuses to execute. Reject before touching that pending query.
    return Promise.reject(new PageReadTimeout());
  }
  return new Promise<T>((resolve,reject)=>{
    let settled=false;
    const stop=()=>{if(!settled){settled=true;cancel?.();reject(new PageReadTimeout());}};
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
function boundedQuery<T extends QueryLike>(query:T):T{
  if(!budgets.getStore())return query;
  let pending:Promise<unknown>|undefined;
  const start=()=>pending??=(async()=>{
    const prepare=budgets.getStore()?.prepareStatement;
    if(!prepare)return withinBudget(()=>query,()=>query.cancel());
    await prepare();
    try{return await query;}catch(error){if(error&&typeof error==='object'&&'code'in error&&error.code==='57014')throw new PageReadTimeout();throw error;}
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
        const budget=budgets.getStore();
        if(!budget)return Reflect.apply(value,target,args);
        if(Date.now()>=budget.deadline)return Promise.reject(new PageReadTimeout());
        return new Promise((resolve,reject)=>{
          // Bound pool acquisition, but once acquired let the native driver
          // finish cancellation/rollback before releasing this transaction.
          // An outer race at that point could reuse a connection too early.
          const timer=setTimeout(()=>reject(new PageReadTimeout()),budget.deadline-Date.now());
          args[callbackIndex]=async(sql:object)=>{
            clearTimeout(timer);
            const remaining=budget.deadline-Date.now();
            if(remaining<=0)throw new PageReadTimeout();
            // PostgreSQL is the second cancellation boundary: even if the
            // separate native cancel connection fails, this read cannot run
            // indefinitely. Transaction-local state never leaks into the pool.
            const native=sql as {unsafe:(query:string,parameters:string[])=>QueryLike};
            // A savepoint inherits its transaction's server timeout. Every
            // actual nested query is prepared below with its remaining time;
            // do not spend an extra roundtrip on an otherwise empty savepoint.
            if(key==='begin'){
              const setting=native.unsafe("SELECT set_config('statement_timeout',$1,true)",[String(remaining)]);
              await withinBudget(()=>setting,()=>setting.cancel());
            }
            const prepareStatement=async()=>{
              const left=budget.deadline-Date.now();if(left<=0)throw new PageReadTimeout();
              return withinBudget(()=>native.unsafe("SELECT set_config('statement_timeout',$1,true)",[String(left)]));
            };
            return budgets.run({...budget,prepareStatement},()=>callback(withPageReadQueryLimits(sql)));
          };
          Promise.resolve(Reflect.apply(value,target,args)).then(result=>{clearTimeout(timer);resolve(result);},error=>{clearTimeout(timer);reject(error&&typeof error==='object'&&'code'in error&&error.code==='57014'?new PageReadTimeout():error);});
        });
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
  const remaining=budget.deadline-Date.now();
  if(remaining<=0)return Promise.reject(new PageReadTimeout());
  const original=init?.signal??(input instanceof Request?input.signal:undefined);
  const deadline=AbortSignal.timeout(remaining);
  const signal=original?AbortSignal.any([original,deadline]):deadline;
  return withinBudget(()=>fetchPort(input,{...init,signal}));
 };
}
