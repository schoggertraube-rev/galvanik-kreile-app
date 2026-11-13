'use client';
import {useEffect,useState} from 'react';
import {usePermissions} from '@/lib/auth/PermissionsContext';
import {OFFLINE_DEVICE_STATUS_COPY} from '@/ui/situationCatalog';
import {useSync} from './SyncContext';
import {deviceStandNotice} from './deviceStandNotice';
import {QuarantinedOriginals} from './QuarantinedOriginals';
import styles from './DeviceStandStatus.module.css';

/** PL16:32: the one active status line, with the existing reading/queue source. */
export function DeviceStandStatus(){
 const {offline24h}=usePermissions();
 const {isOnline,outboxItems,deviceStand,pendingStorageUnavailable,storagePersistence}=useSync();
 const [now,setNow]=useState(()=>Date.now()),[quarantineOpen,setQuarantineOpen]=useState(false);
 useEffect(()=>{
  if(!offline24h)return;
  const tick=()=>setNow(Date.now()),initial=setTimeout(tick,0),timer=setInterval(tick,30_000);
  window.addEventListener('focus',tick);document.addEventListener('visibilitychange',tick);
  return()=>{clearTimeout(initial);clearInterval(timer);window.removeEventListener('focus',tick);document.removeEventListener('visibilitychange',tick);};
 },[offline24h,deviceStand]);
 if(!offline24h)return null;
 const pending=outboxItems.filter(item=>item.status!=='synced'&&item.status!=='conflict').length;
 const notice=deviceStandNotice({stand:deviceStand,storageUnavailable:pendingStorageUnavailable,online:isOnline,pending,quarantined:outboxItems.filter(item=>item.status==='conflict').length,now});
 const persistence=storagePersistence==='DENIED'||storagePersistence==='UNAVAILABLE'?OFFLINE_DEVICE_STATUS_COPY.persistence:null;
 if(!notice.text&&!notice.quarantine&&!persistence)return null;
 return <>
  <div role="status" aria-label={OFFLINE_DEVICE_STATUS_COPY.networkStatus} aria-live="polite" data-spec-id="offline.zeile" data-tone={notice.warning||persistence?'warn':'info'} className={styles.line}>
   {notice.text&&<span>{notice.text}</span>}{persistence&&<span>{persistence}</span>}
   {notice.quarantine&&<button type="button" onClick={()=>setQuarantineOpen(true)}>{notice.quarantine}</button>}
  </div>
  {quarantineOpen&&<QuarantinedOriginals onClose={()=>setQuarantineOpen(false)}/>}
 </>;
}
