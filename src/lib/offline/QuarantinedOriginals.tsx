'use client';
import {useLayoutEffect,useRef,useState} from 'react';
import {Dialog} from '@/ui/kr';
import {usePermissions} from '@/lib/auth/PermissionsContext';
import {getIntakePendingScopeAction} from '@/app/actions/eingang.actions';
import {getIntakeDeviceId,requestGlobalCreate} from '@/modules/eingang/public';
import {OFFLINE_TAKEOVER_COPY} from '@/ui/situationCatalog';
import {useSync} from './SyncContext';
import {adoptQuarantinedOriginal} from './pendingStore';

function preview(value:unknown){
 const seen=new WeakSet<object>();
 const parts:string[]=[];
 function read(entry:unknown,inheritedDate?:string){
  if(!entry||typeof entry!=='object'||seen.has(entry))return;
  seen.add(entry);
  const row=entry as Record<string,unknown>;
  const rawDate=row.deviceCapturedAt??row.capturedAt??inheritedDate;
  const date=typeof rawDate==='string'&&rawDate&&Number.isFinite(Date.parse(rawDate))?rawDate:inheritedDate;
  const file=typeof File!=='undefined'&&row.file instanceof File?row.file:null;
  const text=typeof row.text==='string'?row.text:null;
  const name=file?.name??(row.kind==='file'&&typeof row.name==='string'?row.name:null);
  if(text||name){
   parts.push(name?OFFLINE_TAKEOVER_COPY.file:OFFLINE_TAKEOVER_COPY.note);
   if(date)parts.push(new Date(date).toLocaleString('de-DE'));
   parts.push(name??text!.slice(0,200));
   return;
  }
  read(row.original,date);if(parts.length===0)read(row.payload,date);
 }
 read(value);
 return parts.length?parts.join(' · '):OFFLINE_TAKEOVER_COPY.unreadable;
}

/** Reads the same queue projection as the header; never discards an original. */
export function QuarantinedOriginals({onClose}:{onClose:()=>void}){
 const {quarantinedOriginals}=useSync(),{hasArea,offlineScope,status}=usePermissions();
 const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState<string|null>(null);
 const busyRef=useRef(false),currentScope=useRef<string|null>(status==='authenticated'?offlineScope:null);
 useLayoutEffect(()=>{currentScope.current=status==='authenticated'?offlineScope:null;return()=>{currentScope.current=null;};},[offlineScope,status]);
 async function adopt(id:string){
  if(busyRef.current||status!=='authenticated'||!offlineScope)return;busyRef.current=true;setBusy(id);setError(null);
  try{
   // Offline this is only the existing login's local namespace. The real
   // capture command still checks the original actor and Eingang on replay.
   if(navigator.onLine){const checked=await getIntakePendingScopeAction();if(checked.code!=='OK'||checked.scope!==offlineScope)throw Error('OFFLINE_TAKEOVER_SCOPE_REQUIRED');}
   if(currentScope.current!==offlineScope)return;
   const saved=await adoptQuarantinedOriginal(offlineScope,id,getIntakeDeviceId(),()=>currentScope.current);
   if(saved.code!=='OK')throw Error('OFFLINE_TAKEOVER_SOURCE_INCOMPLETE');
   if(currentScope.current!==offlineScope)return;
   requestGlobalCreate({intent:'DIRECT_INTAKE',pendingOriginalId:saved.original.itemId});onClose();
  }catch(cause){console.error('[OFFLINE_TAKEOVER_UNAVAILABLE]',cause instanceof Error?cause.name:'UnknownError');setError(OFFLINE_TAKEOVER_COPY.unavailable);}
  finally{busyRef.current=false;setBusy(null);}
 }
 return <Dialog titel={OFFLINE_TAKEOVER_COPY.title} onSchliessen={onClose}>
  {error&&<p role="alert">{error}</p>}
  {!hasArea('eingang')&&<p>{OFFLINE_TAKEOVER_COPY.noRight}</p>}
  {quarantinedOriginals.map(original=><section key={original.id} data-spec-id="offline.original">
   <p>{preview(original)}</p>
   {hasArea('eingang')&&<button type="button" disabled={busy!==null} onClick={()=>void adopt(original.id)}>{OFFLINE_TAKEOVER_COPY.adopt}</button>}
  </section>)}
 </Dialog>;
}
