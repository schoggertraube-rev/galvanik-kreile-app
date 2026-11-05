"use client";
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {KrApp,useKrGeraet} from '@/ui/kr';
import {MailSelectionDialog,type MailSelectionPorts} from './MailSelectionDialog';

/** One 3.4 selection layer above the caller, without another creation flow. */
export function IntakeMessageDialogs({ports}:{ports:MailSelectionPorts}){
 const [target,setTarget]=useState<'eingang'|'kundeneu'|null>(null),device=useKrGeraet();
 useEffect(()=>{
  const open=(event:Event)=>{const value=(event as CustomEvent<{ziel?:string;arg?:unknown}>).detail;
   if(value?.ziel!=='mailein'||value.arg!=='auswahl#eingang'&&value.arg!=='auswahl#kundeneu')return;
   event.preventDefault();setTarget(value.arg==='auswahl#eingang'?'eingang':'kundeneu');
  };
  window.addEventListener('kreile:oeffne',open);return()=>window.removeEventListener('kreile:oeffne',open);
 },[]);
 return target&&typeof document!=='undefined'?createPortal(<KrApp geraet={device} portal><MailSelectionDialog key={target} ports={ports} target={target} onClose={()=>setTarget(null)}/></KrApp>,document.body):null;
}
