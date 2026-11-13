import type {DeviceQuoteListResult,readQuoteAction} from '@/app/actions/quotes.actions';
import type {PendingDeviceRead} from './pendingStore';
import {refreshDevicePortCohort,type CollectedDeviceReads,type DeviceReadFence} from './devicePortRead';
type QuoteRead=Awaited<ReturnType<typeof readQuoteAction>>;
export type DeviceQuoteRefreshPorts={list:()=>Promise<DeviceQuoteListResult>;read:(id:string)=>Promise<QuoteRead>;currentScope:()=>string|null};
/** Collect actual canonical responses once; the caller owns the transaction. */
export async function collectDeviceQuotes(fence:DeviceReadFence,ports:DeviceQuoteRefreshPorts):Promise<CollectedDeviceReads>{
 const list=await ports.list();
 if(ports.currentScope()!==fence.scope)return {code:'STALE'};
 if(list.code!=='OK'||!list.cacheLoginScope||!Number.isFinite(Date.parse(list.serverReadAt)))return {code:'SOURCE_INCOMPLETE'};
 if(list.cacheLoginScope!==fence.loginScope)return {code:'STALE'};
 if(new Set(list.quotes.map(row=>row.quoteId)).size!==list.quotes.length)return {code:'SOURCE_INCOMPLETE'};
 const values:PendingDeviceRead[]=[];
 for(const target of list.quotes){
  if(ports.currentScope()!==fence.scope)return {code:'STALE'};
  const read=await ports.read(target.quoteId);
  if(read.code!=='OK'||read.quote.quoteId!==target.quoteId||read.quote.version<target.version||!read.cacheLoginScope||!read.nextActionRule)return {code:'SOURCE_INCOMPLETE'};
  values.push({port:'quote.u2',portVersion:1,objectId:target.quoteId,serverReadAt:read.serverReadAt,serverChangedAt:read.quote.updatedAt,sourceLoginScope:read.cacheLoginScope,response:read.nextActionRule});
 }
 if(ports.currentScope()!==fence.scope)return {code:'STALE'};
 return {code:'COLLECTED',values,serverReadAt:list.serverReadAt};
}
export async function refreshDeviceQuotes(scope:string,enabled:boolean,ports:DeviceQuoteRefreshPorts){return refreshDevicePortCohort(scope,enabled,'quote.u2',ports.currentScope,fence=>collectDeviceQuotes(fence,ports));}
