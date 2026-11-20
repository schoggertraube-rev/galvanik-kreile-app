import {AsyncLocalStorage} from 'node:async_hooks';

/** Request-local only. Commands outside a page read retain their transaction contract. */
type ReadBudget={startedAt:number;deadline:number;cancel:Set<()=>void>};
const budgets=new AsyncLocalStorage<ReadBudget>();
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
  const start=()=>pending??=withinBudget(()=>query,()=>query.cancel());
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
          args[callbackIndex]=(sql:object)=>{
            clearTimeout(timer);
            if(Date.now()>=budget.deadline)throw new PageReadTimeout();
            return callback(withPageReadQueryLimits(sql));
          };
          Promise.resolve(Reflect.apply(value,target,args)).then(result=>{clearTimeout(timer);resolve(result);},error=>{clearTimeout(timer);reject(error);});
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
