'use client';
import{useEffect,useState}from'react';
import{createPortal}from'react-dom';
import{KrApp,useKrGeraet}from'@/ui/kr';
import{TaskDialog,type TaskPorts}from'./TaskDialog';
import{TASK_KINDS,type TaskKind,type TaskOpenRequest}from'../contract';

export function TaskDialogs({ports,onRefresh}:{ports:TaskPorts;onRefresh:()=>void}){
 const[entry,setEntry]=useState<{key:string;request:TaskOpenRequest}|null>(null),[message,setMessage]=useState<string|null>(null),device=useKrGeraet();
 useEffect(()=>{
  const open=(arg:string)=>{const[id,mode]=arg.split('#',2);if(!id)return;
   const request:TaskOpenRequest=mode&&TASK_KINDS.includes(mode as TaskKind)?{reference:{type:mode==='aufgabe'?'kunde':'eingang',id},kind:mode as TaskKind,...(mode!=='aufgabe'?{itemId:id}:{})}:{taskId:id};
   setEntry({key:crypto.randomUUID(),request});
  };
  const handler=(event:Event)=>{const value=(event as CustomEvent<{ziel?:string;arg?:unknown;taskRequest?:TaskOpenRequest}>).detail;if(value?.ziel!=='aufgabe')return;if(value.taskRequest){event.preventDefault();setEntry({key:crypto.randomUUID(),request:value.taskRequest});return;}if(typeof value.arg==='string'){event.preventDefault();open(value.arg);}};
  const fromHash=()=>{const match=/^#aufgabe:(.+)$/u.exec(location.hash);if(match)open(decodeURIComponent(match[1]));};
  window.addEventListener('kreile:oeffne',handler);window.addEventListener('hashchange',fromHash);const timer=setTimeout(fromHash,0);
  return()=>{clearTimeout(timer);window.removeEventListener('kreile:oeffne',handler);window.removeEventListener('hashchange',fromHash);};
 },[]);
 const close=()=>{setEntry(null);if(location.hash.startsWith('#aufgabe:'))history.replaceState(history.state,'',location.pathname+location.search);};
 return <>{message?<div role="status" className="kr-toast">{message}</div>:null}{entry&&typeof document!=='undefined'?createPortal(<KrApp geraet={device} portal><TaskDialog key={entry.key} request={entry.request} ports={ports} onClose={close} onMessage={text=>{setMessage(text);onRefresh();}}/></KrApp>,document.body):null}</>;
}
