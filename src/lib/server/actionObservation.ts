import 'server-only';
import {AsyncLocalStorage} from 'node:async_hooks';
import type {AuthorizationSnapshot} from './authorization';
import type {TechnicalEvent} from '@/modules/logging/public';
type Reporter=(authorization:AuthorizationSnapshot|null,event:TechnicalEvent)=>Promise<boolean>;

// Observation only: no cache, replacement identity or permission decision.
// The real resolver publishes the exact snapshot that the business command already received.
const scope=new AsyncLocalStorage<{authorization:AuthorizationSnapshot|null;attempted:boolean;report?:Reporter;failures:Set<string>;tenantTransactions:Map<string,number>}>();
export function actionObservationActive(){return scope.getStore()!==undefined;}
/** Actual transaction entry only, including SQL-function writers. No command
 * result, claimed actor or SQL-text heuristic is used as a write substitute. */
export function observeTenantTransaction(tenantId:string){
 const current=scope.getStore();
 if(current)current.tenantTransactions.set(tenantId,(current.tenantTransactions.get(tenantId)??0)+1);
}
/** Only the snapshot already returned by the real resolver in this Action. */
export function readObservedAuthorization(){return scope.getStore()?.authorization??null;}
/** Defer caught diagnostics until the enclosing business work has settled. */
export function recordObservedFailure(identifier:string){
 if(/^[A-Z][A-Z0-9_]{1,99}$/.test(identifier))scope.getStore()?.failures.add(identifier);
}
/** A provider boundary reports metadata through its enclosing Action's one sink. */
export async function reportObservedTechnical(event:TechnicalEvent):Promise<boolean>{
 const current=scope.getStore();
 if(!current?.report)return false;
 try{return await current.report(current.authorization,event);}catch{return false;}
}
export function observeAuthorizationAttempt(){const current=scope.getStore();if(current)current.attempted=true;}
export function observeResolvedAuthorization(authorization:AuthorizationSnapshot){
 const current=scope.getStore();if(current)current.authorization=authorization;
}
export function withActionObservation<T>(work:(read:()=>{authorization:AuthorizationSnapshot|null;attempted:boolean;failures:ReadonlySet<string>;tenantTransactions:ReadonlyMap<string,number>})=>Promise<T>,report?:Reporter):Promise<T>{
 const current={authorization:null as AuthorizationSnapshot|null,attempted:false,report,failures:new Set<string>(),tenantTransactions:new Map<string,number>()};
 return scope.run(current,()=>work(()=>current));
}
