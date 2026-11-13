import type {DeviceQuoteListResult,readQuoteAction} from '@/app/actions/quotes.actions';
import type {PendingDeviceRead} from './pendingStore';
import {captureDeviceReadFence,retainDevicePortResponse} from './devicePortRead';
type QuoteRead=Awaited<ReturnType<typeof readQuoteAction>>;
export type DeviceQuoteRefreshPorts={list:()=>Promise<DeviceQuoteListResult>;read:(id:string)=>Promise<QuoteRead>;currentScope:()=>string|null};
type Result={code:'DISABLED'|'STALE'|'SOURCE_INCOMPLETE'}|{code:'STORED';readCount:number};
const running=new Map<string,Promise<Result>>();
/** Existing read Actions only. A quote cohort is replaced in one transaction;
 * this does not mark the whole multi-domain device stand complete or fresh. */
export async function refreshDeviceQuotes(scope:string,enabled:boolean,ports:DeviceQuoteRefreshPorts):Promise<Result>{
 if(!enabled)return {code:'DISABLED'};
 const fence=await captureDeviceReadFence(scope,true);
 if(!fence||ports.currentScope()!==scope)return {code:'STALE'};
 const key=scope+':'+fence.loginScope+':'+fence.generation;
 const existing=running.get(key);if(existing)return existing;
 const work=(async():Promise<Result>=>{
  try{
   const list=await ports.list();
   if(ports.currentScope()!==scope)return {code:'STALE'};
   if(list.code!=='OK'||!list.cacheLoginScope||!Number.isFinite(Date.parse(list.serverReadAt)))return {code:'SOURCE_INCOMPLETE'};
   if(list.cacheLoginScope!==fence.loginScope)return {code:'STALE'};
   if(new Set(list.quotes.map(row=>row.quoteId)).size!==list.quotes.length)return {code:'SOURCE_INCOMPLETE'};
   const values:PendingDeviceRead[]=[];
   for(const target of list.quotes){
    if(ports.currentScope()!==scope)return {code:'STALE'};
    const read=await ports.read(target.quoteId);
    if(read.code!=='OK'||read.quote.quoteId!==target.quoteId||read.quote.version<target.version||!read.cacheLoginScope||!read.nextActionRule)return {code:'SOURCE_INCOMPLETE'};
    values.push({port:'quote.u2',portVersion:1,objectId:target.quoteId,serverReadAt:read.serverReadAt,serverChangedAt:read.quote.updatedAt,sourceLoginScope:read.cacheLoginScope,response:read.nextActionRule});
   }
   if(ports.currentScope()!==scope)return {code:'STALE'};
   const stored=await retainDevicePortResponse(scope,true,values,fence,list.serverReadAt);
   return stored.code==='STORED'?{code:'STORED',readCount:values.length}:stored.code==='STALE'?{code:'STALE'}:{code:'SOURCE_INCOMPLETE'};
  }catch(error){console.error('[OFFLINE_QUOTE_REFRESH_FAILED]',error instanceof Error?error.name:'UnknownError');return {code:'SOURCE_INCOMPLETE'};}
 })();
 running.set(key,work);
 try{return await work;}finally{if(running.get(key)===work)running.delete(key);}
}
