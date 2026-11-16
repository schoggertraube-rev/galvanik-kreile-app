'use server';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readLog,logClientDiagnostics,logTechnical} from '@/modules/logging/server-public';
import {readLoggingSettings} from '@/modules/fundament/server-public';
import type {LogFilter} from '@/modules/logging/public';
import {offlinePartition} from '@/lib/server/offlinePartition';

type CaptureState={code:'OK';enabled:boolean;scope:string}|{code:'UNAUTHENTICATED'|'SOURCE_INCOMPLETE'|'UNAVAILABLE'};
type ProtocolRead=Awaited<ReturnType<typeof readLog>>|{code:'UNAUTHENTICATED'};
export async function getProtocolLogAction(filter:{capture:true}):Promise<CaptureState>;
export async function getProtocolLogAction(filter?:LogFilter):Promise<ProtocolRead>;
export async function getProtocolLogAction(filter:LogFilter|{capture:true}={}):Promise<ProtocolRead|CaptureState>{
 const auth=await resolveAuthorization();
 if(!auth.ok)return {code:'UNAUTHENTICATED' as const};
 // Transport metadata only, never the restricted protocol contents. Every batch
 // still verifies the current login; no second authority or public read route.
 if(filter&&typeof filter==='object'&&'capture'in filter){
  if(Object.keys(filter).length!==1||filter.capture!==true)return {code:'VALIDATION_ERROR' as const};
  try{const settings=await readLoggingSettings(auth.data);return settings?{code:'OK',enabled:settings.enabled,scope:offlinePartition(auth.data)}:{code:'SOURCE_INCOMPLETE'};}
  catch{return {code:'UNAVAILABLE'};}
 }
 return readLog(auth.data,filter,readLoggingSettings);
}

export async function recordProtocolClicksAction(input:unknown,scope?:string|null){
 // Explicitly unattributed capture is only counted, even if another login is
 // now present. It must never be assigned to that later login.
 if(scope===null)return logClientDiagnostics(null,input,readLoggingSettings);
 const auth=await resolveAuthorization();
 if(!auth.ok){await logTechnical(null,{type:'server_error',command:'recordProtocolClicksAction',subject:{type:'action',id:'recordProtocolClicksAction'},reason:'UNAUTHENTICATED'});return {code:'UNAUTHENTICATED' as const};}
 if(scope!==undefined&&scope!==offlinePartition(auth.data))return {code:'FORBIDDEN' as const};
 if(typeof scope!=='string'&&Array.isArray(input)&&input.some(row=>row&&typeof row==='object'&&row.kind==='error'))return {code:'FORBIDDEN' as const};
 return logClientDiagnostics(auth.data,input,readLoggingSettings);
}
