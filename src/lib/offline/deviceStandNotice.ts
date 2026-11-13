import {OFFLINE_DEVICE_STATUS_COPY} from '@/ui/situationCatalog';
import type {DeviceStandSnapshot} from './SyncContext';

/** Presentation only: never an authorization or a second freshness store. */
export function deviceStandNotice(input:{stand:DeviceStandSnapshot|undefined;storageUnavailable:boolean;online:boolean;pending:number;quarantined:number;now:number}):{text:string|null;warning:boolean;quarantine:string|null}{
 const quarantine=input.quarantined>0?OFFLINE_DEVICE_STATUS_COPY.quarantine(input.quarantined):null;
 if(input.storageUnavailable||input.stand?.code==='UNAVAILABLE')return {text:OFFLINE_DEVICE_STATUS_COPY.unavailable,warning:true,quarantine};
 if(input.stand?.code!=='COMPLETE')return {text:OFFLINE_DEVICE_STATUS_COPY.incomplete,warning:true,quarantine};
 const stamp=Date.parse(input.stand.serverReadAt),age=input.now-stamp;
 if(!Number.isFinite(age)||age<0)return {text:OFFLINE_DEVICE_STATUS_COPY.invalidWindow,warning:true,quarantine};
 if(age>=24*60*60*1000)return {text:OFFLINE_DEVICE_STATUS_COPY.expired,warning:true,quarantine};
 const time=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(stamp));
 return {text:input.online?(input.pending>0?OFFLINE_DEVICE_STATUS_COPY.pending(input.pending):null):OFFLINE_DEVICE_STATUS_COPY.stand(time,input.pending),warning:!input.online,quarantine};
}
