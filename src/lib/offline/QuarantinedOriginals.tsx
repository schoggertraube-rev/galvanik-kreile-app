'use client';
import {useState} from 'react';
import {Dialog} from '@/ui/kr';
import {usePermissions} from '@/lib/auth/PermissionsContext';
import {getIntakePendingScopeAction} from '@/app/actions/eingang.actions';
import {getIntakeDeviceId,requestGlobalCreate} from '@/modules/eingang/public';
import {OFFLINE_TAKEOVER_COPY} from '@/ui/situationCatalog';
import {useSync} from './SyncContext';
import {adoptQuarantinedOriginal} from './pendingStore';

function preview(value:unknown){
 const seen=new WeakSet<object>();
 return JSON.stringify(value,(_key,entry)=>{
  if(typeof entry==='bigint')return String(entry);
  if(typeof File!=='undefined'&&entry instanceof File)return {name:entry.name,type:entry.type,size:entry.size};
  if(entry&&typeof entry==='object'){if(seen.has(entry))return OFFLINE_TAKEOVER_COPY.reference;seen.add(entry);}
  return entry;
 },2);
}

/** Reads the same queue projection as the header; never discards an original. */
export function QuarantinedOriginals({onClose}:{onClose:()=>void}){
 const {quarantinedOriginals}=useSync(),{hasArea,offlineScope,status}=usePermissions();
 const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState<string|null>(null);
 async function adopt(id:string){
  if(busy||status!=='authenticated'||!offlineScope)return;setBusy(id);setError(null);
  try{
   const checked=await getIntakePendingScopeAction();
   if(checked.code!=='OK'||checked.scope!==offlineScope)throw Error('OFFLINE_TAKEOVER_SCOPE_REQUIRED');
   const saved=await adoptQuarantinedOriginal(checked.scope,id,getIntakeDeviceId());
   if(saved.code!=='OK')throw Error('OFFLINE_TAKEOVER_SOURCE_INCOMPLETE');
   requestGlobalCreate({intent:'DIRECT_INTAKE',pendingOriginalId:saved.original.itemId});onClose();
  }catch(cause){console.error('[OFFLINE_TAKEOVER_UNAVAILABLE]',cause instanceof Error?cause.name:'UnknownError');setError(OFFLINE_TAKEOVER_COPY.unavailable);}
  finally{setBusy(null);}
 }
 return <Dialog titel={OFFLINE_TAKEOVER_COPY.title} onSchliessen={onClose}>
  {error&&<p role="alert">{error}</p>}
  {!hasArea('eingang')&&<p>{OFFLINE_TAKEOVER_COPY.noRight}</p>}
  {quarantinedOriginals.map(original=><section key={original.id} data-spec-id="offline.original">
   <pre>{preview(original.payload)}</pre>
   {hasArea('eingang')&&<button type="button" disabled={busy!==null} onClick={()=>void adopt(original.id)}>{OFFLINE_TAKEOVER_COPY.adopt}</button>}
  </section>)}
 </Dialog>;
}
