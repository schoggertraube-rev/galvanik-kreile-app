'use client';
import {BELEG_AUTO_COPY as C} from '@/ui/situationCatalog';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Button,Dialog,Hinweis,KrApp,Toast,useKrGeraet} from '@/ui/kr';
import type {InvoicePorts,InvoiceView} from '../invoiceContract';
import {IncomingInvoiceDialog} from './IncomingInvoiceDialog';

export function IncomingInvoiceDialogs({ports,allowed,onRefresh}:{ports:InvoicePorts;allowed:boolean;onRefresh:()=>void}){
 const [entry,setEntry]=useState<{key:string;view:InvoiceView}|null>(null),[loading,setLoading]=useState(false),[failure,setFailure]=useState<string|null>(null);
 const [message,setMessage]=useState<{text:string;taskId?:string}|null>(null),device=useKrGeraet(),generation=useRef(0),autoKeys=useRef(new Map<string,string>()),automatic=useRef(new Map<string,Promise<Awaited<ReturnType<InvoicePorts['save']>>>>());
 const open=useCallback(async(arg:string)=>{
  if(!allowed){setMessage({text:'Recht Geld fehlt'});return;}
  const id=arg.split('#',2)[0];if(!id)return;const current=++generation.current;setLoading(true);setFailure(null);
  try{const result=await ports.read({id});if(current!==generation.current)return;
   if(result.code!=='OK'){if(result.code==='FORBIDDEN'){setMessage({text:'Recht Geld fehlt'});return;}setFailure(result.message);return;}
   const view=result.view;
   if(!view.invoice&&view.automation?.state==='ready'&&view.fileId){
    const operation=view.item.id+':'+view.item.version;if(!autoKeys.current.has(operation))autoKeys.current.set(operation,crypto.randomUUID());
    let pending=automatic.current.get(operation);if(!pending){pending=ports.save({automatic:true,itemId:view.item.id,fileId:view.fileId,version:view.item.version,clientKey:autoKeys.current.get(operation)!,fields:view.fields,status:'offen',paidDate:null,proofFileId:null,duplicateId:null,duplicateReason:null,unclearReason:null});automatic.current.set(operation,pending);}
    let saved:Awaited<ReturnType<InvoicePorts['save']>>;try{saved=await pending;}catch(error){automatic.current.delete(operation);throw error;}if(current!==generation.current)return;
    if(saved.code!=='OK'){automatic.current.delete(operation);setFailure('message' in saved?saved.message:C.failed);return;}
    const fresh=await ports.read({id:saved.invoice.id});if(current!==generation.current)return;
    if(fresh.code!=='OK'){setFailure(fresh.message);return;}
    setMessage({text:C.saved});setEntry(null);onRefresh();return;
   }
   setEntry({key:crypto.randomUUID(),view:result.view});
  }catch(error){console.error('[INVOICE_DIALOG_OPEN_FAILED]',error);if(current===generation.current)setFailure('Rechnung konnte nicht gelesen werden · Fehlercode: INVOICE_DIALOG_OPEN_FAILED.');}
  finally{if(current===generation.current)setLoading(false);}
 },[allowed,ports,onRefresh]);
 useEffect(()=>{
  const handler=(event:Event)=>{const value=(event as CustomEvent<{ziel?:string;arg?:unknown}>).detail;if(value?.ziel==='rechnungein'&&typeof value.arg==='string'){event.preventDefault();void open(value.arg);}};
  const fromHash=()=>{const match=/^#rechnungein:(.+)$/u.exec(location.hash);if(match)void open(decodeURIComponent(match[1]));};
  window.addEventListener('kreile:oeffne',handler);window.addEventListener('hashchange',fromHash);const timer=setTimeout(fromHash,0);
  return()=>{clearTimeout(timer);window.removeEventListener('kreile:oeffne',handler);window.removeEventListener('hashchange',fromHash);};
 },[open]);
 const close=()=>{generation.current++;setEntry(null);setLoading(false);setFailure(null);if(location.hash.startsWith('#rechnungein:'))history.replaceState(history.state,'',location.pathname+location.search);};
 const notify=(text:string,taskId?:string)=>{setMessage({text,taskId});onRefresh();};
 return <>{message?<Toast text={message.text} aktion={message.taskId?{text:'Aufgabe ansehen',onClick:()=>ports.openTask(message.taskId!)}:undefined}/>:null}
  {loading?<Toast text={C.saving}/>:null}
  {(entry||failure)&&typeof document!=='undefined'?createPortal(<KrApp geraet={device} portal>
   {entry?<IncomingInvoiceDialog key={entry.key} initial={entry.view} ports={ports} onClose={close} onMessage={notify}/>:<Dialog titel="Rechnung prüfen" onSchliessen={close} fuss={<Button text="Schließen" onClick={close}/>}>
    {loading?<p role="status">Rechnung wird geladen …</p>:<Hinweis ton="warn">{failure}</Hinweis>}</Dialog>}
  </KrApp>,document.body):null}</>;
}
