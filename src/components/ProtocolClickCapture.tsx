'use client';
import {useEffect} from 'react';
import {usePermissions} from '@/lib/auth/PermissionsContext';
import {getProtocolLogAction,recordProtocolClicksAction} from '@/app/actions/logging.actions';
import {installProtocolClickCapture} from '@/modules/logging/public';

/** No UI, permission decision, business queue or second reachability predicate. */
export function ProtocolClickCapture(){
 const {status,offlineScope}=usePermissions();
 useEffect(()=>{
  const scope=status==='authenticated'?offlineScope:null;
  let stopped=false,cleanup=installProtocolClickCapture(scope,recordProtocolClicksAction,false);
  if(scope)void getProtocolLogAction({capture:true}).then(state=>{
   if(!stopped&&state.code==='OK'&&state.enabled&&state.scope===scope){cleanup();cleanup=installProtocolClickCapture(state.scope,recordProtocolClicksAction);}
  }).catch(()=>{console.warn('[PROTOCOL_CAPTURE_SETTINGS_FAILED]');});
  return()=>{stopped=true;cleanup();};
 },[status,offlineScope]);
 return null;
}
