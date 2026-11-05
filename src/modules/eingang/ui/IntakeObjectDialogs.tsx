"use client";
import{useCallback,useEffect,useState}from'react';
import{createPortal}from'react-dom';
import{KrApp,useKrGeraet}from'@/ui/kr';
import{GoodsReceiptDialog,type GoodsReceiptPorts}from'./GoodsReceiptDialog';
import{OriginalDialog,type OriginalPorts}from'./OriginalDialog';
import{INTAKE_CHANGED_EVENT}from'../messageContract';
type Entry={screen:'ware'|'original';arg:string;key:string};
export type IntakeObjectPorts={goods:GoodsReceiptPorts;original:OriginalPorts};
/** The existing navigation bus opens object dialogs, never another creation flow. */
export function IntakeObjectDialogs({ports,allowed,onRefresh}:{ports:IntakeObjectPorts;allowed:boolean;onRefresh:()=>void}){
 const device=useKrGeraet(),[stack,setStack]=useState<Entry[]>([]),[message,setMessage]=useState<string|null>(null);
 const open=useCallback((screen:Entry['screen'],arg:string)=>{
  if(!allowed){setMessage('Eingang ist nicht freigegeben.');return;}
  setStack(previous=>previous.at(-1)?.screen===screen&&previous.at(-1)?.arg===arg?previous:[...previous,{screen,arg,key:crypto.randomUUID()}]);
 },[allowed]);
 useEffect(()=>{
  const handler=(event:Event)=>{const value=(event as CustomEvent<{ziel?:string;arg?:unknown}>).detail;if((value?.ziel==='ware'||value?.ziel==='original')&&typeof value.arg==='string'){if(allowed)event.preventDefault();open(value.ziel,value.arg);}};
  const fromHash=()=>{const match=/^#(ware|original):(.+)$/u.exec(location.hash);if(match)open(match[1] as Entry['screen'],decodeURIComponent(match[2]));};
  window.addEventListener('kreile:oeffne',handler);window.addEventListener('hashchange',fromHash);const initial=setTimeout(fromHash,0);
  return()=>{clearTimeout(initial);window.removeEventListener('kreile:oeffne',handler);window.removeEventListener('hashchange',fromHash);};
 },[open,allowed]);
 const close=()=>{setStack(previous=>previous.slice(0,-1));window.dispatchEvent(new Event(INTAKE_CHANGED_EVENT));if(stack.length===1&&/^#(?:ware|original):/u.test(location.hash))history.replaceState(history.state,'',location.pathname+location.search);};
 const refresh=()=>{window.dispatchEvent(new Event(INTAKE_CHANGED_EVENT));onRefresh();};
 const notify=(text:string)=>{setMessage(text);refresh();};
 const assign=(itemId:string,move:boolean)=>{
  const opened=!window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel:'mailein',arg:itemId+(move?'#umhaengen':'#rein')},cancelable:true}));
  return opened?null:'Kunde zum Original kann in diesem Stand nicht gewählt werden · Code: INTAKE_ASSIGNMENT_VIEW_MISSING.';
 };
 return <>{message?<div role="status" className="kr-toast">{message}</div>:null}{stack.length&&typeof document!=='undefined'?createPortal(<KrApp geraet={device} portal>{stack.map(entry=>{
  const [id,fileId]=entry.arg.split('#',2);
  return entry.screen==='ware'?<GoodsReceiptDialog key={entry.key} orderId={id} sourceId={fileId} ports={ports.goods} onClose={close} onMessage={notify} onOriginal={(item,file)=>open('original',item+'#'+file)}/>
   :<OriginalDialog key={entry.key} fileId={fileId??id} ports={ports.original} onClose={close} onMessage={refresh} onAssign={assign}/>;
 })}</KrApp>,document.body):null}</>;
}
