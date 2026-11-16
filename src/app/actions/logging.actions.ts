'use server';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readLog,logClick} from '@/modules/logging/server-public';
import {readLoggingSettings} from '@/modules/fundament/server-public';
import type {LogFilter} from '@/modules/logging/public';

export async function getProtocolLogAction(filter:LogFilter={}){
 const auth=await resolveAuthorization();
 if(!auth.ok)return {code:'UNAUTHENTICATED' as const};
 return readLog(auth.data,filter,readLoggingSettings);
}

export async function recordProtocolClicksAction(input:unknown){
 const auth=await resolveAuthorization();
 if(!auth.ok)return {code:'UNAUTHENTICATED' as const};
 return logClick(auth.data,input,readLoggingSettings);
}
