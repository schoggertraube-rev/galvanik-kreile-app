'use client';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {KrApp,useKrGeraet} from '@/ui/kr';
import {ComplaintDialog} from './ComplaintDialog';
import {COMPLAINT_CHANGED_EVENT,type ComplaintPorts,type ComplaintRequest} from '../dialogContract';

/** One mounted receiver for every complaint entry; no separate creation route. */
export function ComplaintDialogs({ports,onRefresh}:{ports:ComplaintPorts;onRefresh:()=>void}) {
  const [entry,setEntry]=useState<{key:string;request:ComplaintRequest}|null>(null),[message,setMessage]=useState<string|null>(null),device=useKrGeraet();
  useEffect(()=>{
    const open=(event:Event)=>{
      const value=(event as CustomEvent<{ziel?:string;arg?:unknown}>).detail;
      if(value?.ziel!=='reklamation'||typeof value.arg!=='string'||!value.arg)return;
      const [id,mode]=value.arg.split('#',2);
      if(!id)return;
      event.preventDefault();setEntry({key:crypto.randomUUID(),request:mode?{orderId:id,...(mode!=='aufnehmen'?{sourceItemId:mode}:{})}:{complaintId:id}});
    };
    window.addEventListener('kreile:oeffne',open);
    return()=>window.removeEventListener('kreile:oeffne',open);
  },[]);
  return <>{message?<div role="status" className="kr-toast">{message}</div>:null}{entry&&typeof document!=='undefined'?createPortal(<KrApp geraet={device} portal><ComplaintDialog key={entry.key} request={entry.request} ports={ports} onClose={()=>setEntry(null)} onMessage={text=>{setMessage(text);window.dispatchEvent(new Event(COMPLAINT_CHANGED_EVENT));onRefresh();}}/></KrApp>,document.body):null}</>;
}
