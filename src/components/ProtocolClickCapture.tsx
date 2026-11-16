'use client';
import {useEffect} from 'react';
import {usePermissions} from '@/lib/auth/PermissionsContext';
import {getProtocolLogAction,recordProtocolClicksAction} from '@/app/actions/logging.actions';
import {installProtocolClickCapture} from '@/modules/logging/public';

/** No UI, permission decision, business queue or second reachability predicate. */
export function ProtocolClickCapture(){
 const {status,offlineScope}=usePermissions();
 useEffect(()=>{
  if(status!=='authenticated'||!offlineScope)return;
  let stopped=false,cleanup:(()=>void)|undefined;
  void getProtocolLogAction({capture:true}).then(state=>{
   if(!stopped&&state.code==='OK'&&state.enabled&&state.scope===offlineScope)cleanup=installProtocolClickCapture(state.scope,recordProtocolClicksAction);
  }).catch(()=>{/* unknown capture settings never enable logging */});
  return()=>{stopped=true;cleanup?.();};
 },[status,offlineScope]);
 return null;
}
