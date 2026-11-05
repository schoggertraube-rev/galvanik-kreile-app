"use client";
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {KrApp,useKrGeraet} from '@/ui/kr';
import {MailSelectionDialog,type MailSelectionPorts} from './MailSelectionDialog';
import {TaskDialogs,type TaskPorts} from '@/modules/tasks/public';
import {IntakeAssignmentDialog} from './IntakeAssignmentDialog';
import type {AssignmentMode,AssignmentPorts} from '../assignmentContract';
import {INTAKE_CHANGED_EVENT} from '../messageContract';

/** One 3.4 selection layer above the caller, without another creation flow. */
export function IntakeMessageDialogs({ports,taskPorts,assignmentPorts,onRefresh}:{ports:MailSelectionPorts;taskPorts?:TaskPorts;assignmentPorts?:AssignmentPorts;onRefresh?:()=>void}){
 const [target,setTarget]=useState<'eingang'|'kundeneu'|null>(null),[assignment,setAssignment]=useState<{id:string;mode:AssignmentMode;key:string;channel?:string}|null>(null),[message,setMessage]=useState<string|null>(null),device=useKrGeraet();
 const refresh=()=>{window.dispatchEvent(new Event(INTAKE_CHANGED_EVENT));onRefresh?.();};
 useEffect(()=>{
  const open=(event:Event)=>{const value=(event as CustomEvent<{ziel?:string;arg?:unknown;sourceChannel?:string}>).detail;
   if(value?.ziel!=='mailein')return;
   if(value.arg==='auswahl#eingang'||value.arg==='auswahl#kundeneu'){event.preventDefault();setTarget(value.arg==='auswahl#eingang'?'eingang':'kundeneu');return;}
   if(typeof value.arg!=='string'||!assignmentPorts)return;
   const[id,mode]=value.arg.split('#',2);if(!id)return;
   event.preventDefault();setAssignment({id,mode:mode==='kein'||mode==='umhaengen'||mode==='rein'?mode:'normal',key:crypto.randomUUID(),channel:value.sourceChannel});
  };
  window.addEventListener('kreile:oeffne',open);return()=>window.removeEventListener('kreile:oeffne',open);
 },[assignmentPorts]);
 return <>{message?<div role="status" className="kr-toast">{message}</div>:null}{taskPorts?<TaskDialogs ports={taskPorts} onRefresh={refresh}/>:null}{target&&typeof document!=='undefined'?createPortal(<KrApp geraet={device} portal><MailSelectionDialog key={target} ports={ports} target={target} onClose={()=>setTarget(null)}/></KrApp>,document.body):null}{assignment&&assignmentPorts&&typeof document!=='undefined'?createPortal(<KrApp geraet={device} portal><IntakeAssignmentDialog key={assignment.key} itemId={assignment.id} mode={assignment.mode} sourceChannel={assignment.channel} ports={assignmentPorts} onClose={()=>{setAssignment(null);refresh();}} onMessage={setMessage}/></KrApp>,document.body):null}</>;
}
