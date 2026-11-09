'use client';
import {BELEG_AUTO_COPY as C,belegFailureCopy} from '@/ui/situationCatalog';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Button,Dialog,Hinweis,KrApp,Toast,useKrGeraet} from '@/ui/kr';
import type {InvoicePorts,InvoiceView} from '../invoiceContract';
import {IncomingInvoiceDialog} from './IncomingInvoiceDialog';

export function IncomingInvoiceDialogs({ports,allowed,onRefresh}:{ports:InvoicePorts;allowed:boolean;onRefresh:()=>void}){
 const [entry,setEntry]=useState<{key:string;view:InvoiceView;annotationsOnly?:boolean}|null>(null),[loading,setLoading]=useState(false),[failure,setFailure]=useState<string|null>(null);
 const [message,setMessage]=useState<{text:string;taskId?:string;invoice?:{id:string;version:number}}|null>(null),device=useKrGeraet(),generation=useRef(0),autoKeys=useRef(new Map<string,string>()),automatic=useRef(new Map<string,Promise<Awaited<ReturnType<InvoicePorts['save']>>>>());
 const refresh=useRef(onRefresh),lastOpen=useRef<string|null>(null),undoing=useRef(false);useEffect(()=>{refresh.current=onRefresh;},[onRefresh]);
 const open=useCallback(async(arg:string)=>{
  if(!allowed){setMessage({text:belegFailureCopy('FORBIDDEN')});return;}
  lastOpen.current=arg;const id=arg.split('#',2)[0];if(!id)return;const current=++generation.current;setLoading(true);setFailure(null);
  try{const result=await ports.read({id});if(current!==generation.current)return;
   if(result.code!=='OK'){if(result.code==='FORBIDDEN'){setMessage({text:belegFailureCopy('FORBIDDEN')});return;}setFailure(belegFailureCopy(result.code));return;}
   const view=result.view;
   if(!view.invoice&&['ready','duplicate'].includes(view.automation?.state??'')&&view.fileId){
    const operation=view.item.id+':'+view.item.version;if(!autoKeys.current.has(operation))autoKeys.current.set(operation,crypto.randomUUID());
    let pending=automatic.current.get(operation);if(!pending){pending=ports.save({...(view.automation?.state==='duplicate'?{attachOriginal:true as const}:{automatic:true as const}),itemId:view.item.id,fileId:view.fileId,version:view.item.version,clientKey:autoKeys.current.get(operation)!,fields:view.fields,status:view.automation?.state==='duplicate'?'doppelt':'offen',paidDate:null,proofFileId:null,duplicateId:view.automation?.state==='duplicate'?view.duplicate?.id??null:null,duplicateReason:null,unclearReason:null});automatic.current.set(operation,pending);}
    let saved:Awaited<ReturnType<InvoicePorts['save']>>;try{saved=await pending;}catch(error){automatic.current.delete(operation);throw error;}if(current!==generation.current)return;
    if(saved.code!=='OK'){automatic.current.delete(operation);setFailure(belegFailureCopy(saved.code));return;}
    const fresh=await ports.read({id:saved.invoice.id});if(current!==generation.current)return;
    if(fresh.code!=='OK'){setFailure(belegFailureCopy(fresh.code));return;}
    setMessage(view.automation?.state==='duplicate'?{text:C.exists}:{text:C.saved,invoice:{id:saved.invoice.id,version:saved.invoice.version}});setEntry(fresh.view.annotationChoices?{key:crypto.randomUUID(),view:fresh.view,annotationsOnly:true}:null);if(location.hash.startsWith('#rechnungein:'))history.replaceState(history.state,'',location.pathname+location.search);refresh.current();return;
   }
   setEntry({key:crypto.randomUUID(),view:result.view});
  }catch(error){console.error('[INVOICE_DIALOG_OPEN_FAILED]',error);if(current===generation.current)setFailure(belegFailureCopy('UNAVAILABLE'));}
  finally{if(current===generation.current)setLoading(false);}
 },[allowed,ports]);
 useEffect(()=>{
  const handler=(event:Event)=>{const value=(event as CustomEvent<{ziel?:string;arg?:unknown}>).detail;if(value?.ziel==='rechnungein'&&typeof value.arg==='string'){event.preventDefault();void open(value.arg);}};
  const fromHash=()=>{const match=/^#rechnungein:(.+)$/u.exec(location.hash);if(match)void open(decodeURIComponent(match[1]));};
  window.addEventListener('kreile:oeffne',handler);window.addEventListener('hashchange',fromHash);const timer=setTimeout(fromHash,0);
  return()=>{clearTimeout(timer);window.removeEventListener('kreile:oeffne',handler);window.removeEventListener('hashchange',fromHash);};
 },[open]);
 const close=()=>{generation.current++;setEntry(null);setLoading(false);setFailure(null);if(location.hash.startsWith('#rechnungein:'))history.replaceState(history.state,'',location.pathname+location.search);};
 const undoAutomatic=async()=>{
  const invoice=message?.invoice;if(!invoice||undoing.current)return;undoing.current=true;const operation='undo:'+invoice.id+':'+invoice.version;if(!autoKeys.current.has(operation))autoKeys.current.set(operation,crypto.randomUUID());setLoading(true);setFailure(null);
  try{const saved=await ports.status({command:'undo',invoiceId:invoice.id,version:invoice.version,clientKey:autoKeys.current.get(operation)!,result:'ungueltig',paidDate:null,proofFileId:null,duplicateId:null,reason:C.automaticUndoReason,fields:null});if(saved.code!=='OK'){setFailure(belegFailureCopy(saved.code));return;}const read=await ports.read({id:invoice.id});if(read.code!=='OK'){setFailure(belegFailureCopy(read.code));return;}setEntry({key:crypto.randomUUID(),view:read.view});setMessage({text:C.undone});onRefresh();}catch(error){console.error('[INVOICE_AUTOMATIC_UNDO_FAILED]',error);setFailure(C.failed);}finally{undoing.current=false;setLoading(false);}
 };
 const notify=(text:string,taskId?:string)=>{setMessage({text,taskId});onRefresh();};
 return <>{message?<Toast text={message.text} aktion={message.invoice?{text:C.undo,onClick:()=>void undoAutomatic()}:message.taskId?{text:'Aufgabe ansehen',onClick:()=>ports.openTask(message.taskId!)}:undefined}/>:null}
  {loading?<Toast text={C.saving}/>:null}
  {(entry||failure)&&typeof document!=='undefined'?createPortal(<KrApp geraet={device} portal>
   {entry?<IncomingInvoiceDialog key={entry.key} initial={entry.view} ports={ports} onClose={close} onMessage={notify} onAutomaticReady={()=>void open(entry.view.item.id)} annotationsOnly={entry.annotationsOnly} onUndo={()=>void undoAutomatic()} onInvoiceUpdated={view=>{if(view.invoice)setMessage(current=>current?.invoice?.id===view.invoice!.id?{...current,invoice:{id:view.invoice!.id,version:view.invoice!.version}}:current);}}/>:<Dialog titel="Rechnung prüfen" onSchliessen={close} fuss={<><Button text="Schließen" onClick={close}/>{failure?<Button text={C.retry} onClick={()=>{if(lastOpen.current)void open(lastOpen.current);}}/>:null}</>}>
    {loading?<p role="status">Rechnung wird geladen …</p>:<Hinweis ton="warn">{failure}</Hinweis>}</Dialog>}
  </KrApp>,document.body):null}</>;
}
