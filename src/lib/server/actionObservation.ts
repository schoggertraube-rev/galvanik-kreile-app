import 'server-only';
import {AsyncLocalStorage} from 'node:async_hooks';
import type {AuthorizationSnapshot} from './authorization';

// Observation only: no cache, replacement identity or permission decision.
// The real resolver publishes the exact snapshot that the business command already received.
const scope=new AsyncLocalStorage<{authorization:AuthorizationSnapshot|null;attempted:boolean}>();
export function actionObservationActive(){return scope.getStore()!==undefined;}
export function observeAuthorizationAttempt(){const current=scope.getStore();if(current)current.attempted=true;}
export function observeResolvedAuthorization(authorization:AuthorizationSnapshot){
 const current=scope.getStore();if(current)current.authorization=authorization;
}
export function withActionObservation<T>(work:(read:()=>{authorization:AuthorizationSnapshot|null;attempted:boolean})=>Promise<T>):Promise<T>{
 const current={authorization:null as AuthorizationSnapshot|null,attempted:false};
 return scope.run(current,()=>work(()=>current));
}
