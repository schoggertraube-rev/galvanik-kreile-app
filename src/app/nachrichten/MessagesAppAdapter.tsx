'use client';
import {useMemo} from 'react';
import {IntakeMessages,type IntakeMessagesPorts} from '@/modules/eingang/public';
import {usePermissions} from '@/lib/auth/PermissionsContext';
import {retainDevicePortResponse} from '@/lib/offline/devicePortRead';

/** Keep the existing list and writers; retain only their U2 metadata projection. */
export function MessagesAppAdapter({ports,initialGroup}:{ports:IntakeMessagesPorts;initialGroup?:string}){
 const {offlineScope,offline24h}=usePermissions();
 const wrapped=useMemo<IntakeMessagesPorts>(()=>({...ports,list:async filter=>{
  const result=await ports.list(filter);
  if(result.code==='OK'&&offline24h&&offlineScope){
   if(!result.serverReadAt||!result.cacheLoginScope)console.error('[OFFLINE_MESSAGE_U2_SOURCE_INCOMPLETE]');
   else for(const row of result.messages){
    if(row.nextActionRule)await retainDevicePortResponse(offlineScope,true,{port:'message.u2',portVersion:1,objectId:row.id,serverReadAt:result.serverReadAt,sourceLoginScope:result.cacheLoginScope,response:row.nextActionRule});
    else console.error('[OFFLINE_MESSAGE_U2_SOURCE_INCOMPLETE]');
   }
  }
  return result;
 }}),[ports,offlineScope,offline24h]);
 return <IntakeMessages ports={wrapped} initialGroup={initialGroup}/>;
}
