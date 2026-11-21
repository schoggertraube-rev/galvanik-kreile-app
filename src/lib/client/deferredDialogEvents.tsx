'use client';
import {createElement,useEffect,type ComponentType} from 'react';
export type DeferredDialogGroup='create'|'message'|'object'|'invoice'|'complaint';
/** Transport only: retain the existing navigation event until its original receiver mounts. */
function receiver(event:Event):DeferredDialogGroup|null{
 if(event.type==='path1:global-create-open')return 'create';
 const detail=(event as CustomEvent<{ziel?:string;arg?:unknown;taskRequest?:unknown}>).detail;
 if(detail?.ziel==='aufgabe'&&(detail.taskRequest||typeof detail.arg==='string'))return 'message';
 if(typeof detail?.arg!=='string')return null;
 if(detail.ziel==='mailein')return 'message';
 if(['ware','original','kvware'].includes(detail.ziel??''))return 'object';
 if(detail.ziel==='rechnungein')return 'invoice';
 if(detail.ziel==='reklamation'&&detail.arg)return 'complaint';
 if(detail.ziel==='mail'&&detail.arg.endsWith('#auftragsbestaetigung')&&detail.arg.length>'#auftragsbestaetigung'.length)return 'complaint';
 return null;
}
export function createDeferredDialogEvents(load:()=>void){
 const ready=new Set<DeferredDialogGroup>();
 let stopped=false,flushing=false;
 const replayed=new WeakSet<Event>();
 const pending:Array<{group:DeferredDialogGroup;type:string;detail:unknown;cancelable:boolean}>=[];
 const flush=()=>{
  if(flushing)return;flushing=true;
  try{while(!stopped&&pending.length&&ready.has(pending[0].group)){
   const saved=pending.shift()!,event=new CustomEvent(saved.type,{detail:saved.detail,cancelable:saved.cancelable});
   replayed.add(event);window.dispatchEvent(event);
  }}finally{flushing=false;}
 };
 const capture=(event:Event)=>{
  const group=receiver(event);if(stopped||replayed.has(event)||!group||ready.has(group)&&pending.length===0||event.defaultPrevented)return;
  event.preventDefault();event.stopImmediatePropagation();
  pending.push({group,type:event.type,detail:(event as CustomEvent).detail,cancelable:event.cancelable});load();flush();
 };
 return {
  attach(){
   stopped=false;
   window.addEventListener('path1:global-create-open',capture,true);window.addEventListener('kreile:oeffne',capture,true);
   return()=>{stopped=true;pending.length=0;window.removeEventListener('path1:global-create-open',capture,true);window.removeEventListener('kreile:oeffne',capture,true);};
  },
  ready(group:DeferredDialogGroup){
   if(stopped)return;ready.add(group);
   flush();
  },
 };
}
/** Child effects install the actual receiver before this parent effect releases its events. */
export function withDeferredDialogReady<P extends object>(Component:ComponentType<P>,group:DeferredDialogGroup){
 return function DeferredDialogReady({onReceiverReady,...props}:P&{onReceiverReady:(group:DeferredDialogGroup)=>void}){
  useEffect(()=>{onReceiverReady(group);},[onReceiverReady]);
  return createElement(Component,props as P);
 };
}
