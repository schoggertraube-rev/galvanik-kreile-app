'use client';
import {useRef,useState} from 'react';
import {Button,Feld,Textfeld} from '@/ui/kr';
import {BELEG_META_COPY as C,belegFailureCopy} from '@/ui/situationCatalog';
import type {InvoicePorts,InvoiceView} from '../invoiceContract';

/** Optional metadata uses the same status Action; invoice amounts and payment are never edited here. */
export function InvoiceAnnotationEditor({view,ports,onSaved}:{view:InvoiceView;ports:InvoicePorts;onSaved:(view:InvoiceView)=>void}){
 const [current,setCurrent]=useState(view),[remark,setRemark]=useState(view.annotations?.remark??''),[personId,setPerson]=useState(view.annotations?.person?.id??''),[vehicleId,setVehicle]=useState(view.annotations?.vehicle?.id??''),[message,setMessage]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const [conflict,setConflict]=useState(false);
 const working=useRef(false),key=useRef(crypto.randomUUID());
 const reload=async()=>{
  if(working.current||!current.invoice)return;working.current=true;setBusy(true);
  try{const fresh=await ports.read({id:current.invoice.id});if(fresh.code!=='OK'){setMessage(belegFailureCopy(fresh.code));return;}setCurrent(fresh.view);onSaved(fresh.view);setConflict(false);setMessage(null);}
  catch(error){console.error('[INVOICE_ANNOTATIONS_RELOAD_FAILED]',{name:error instanceof Error?error.name:'unknown'});setMessage(belegFailureCopy('UNAVAILABLE'));}
  finally{working.current=false;setBusy(false);}
 };
 const change=(set:(value:string)=>void,value:string)=>{if(working.current)return;set(value);key.current=crypto.randomUUID();setMessage(null);};
 const save=async()=>{
  if(working.current||!current.invoice)return;working.current=true;setBusy(true);setMessage(null);
  try{
   const result=await ports.status({command:'annotations',invoiceId:current.invoice.id,version:current.invoice.version,clientKey:key.current,result:current.invoice.zahlstatus,paidDate:null,proofFileId:null,duplicateId:null,reason:null,fields:null,annotations:{remark,personId:personId||null,vehicleId:vehicleId||null}});
   if(result.code!=='OK'){setConflict(result.code==='CONFLICT');setMessage(belegFailureCopy(result.code));return;}
   const fresh=await ports.read({id:current.invoice.id});if(fresh.code!=='OK'){setMessage(belegFailureCopy(fresh.code));return;}
   setCurrent(fresh.view);onSaved(fresh.view);key.current=crypto.randomUUID();setMessage(C.saved);
  }catch(error){console.error('[INVOICE_ANNOTATIONS_SAVE_FAILED]',{name:error instanceof Error?error.name:'unknown'});setMessage(belegFailureCopy('UNAVAILABLE'));}
  finally{working.current=false;setBusy(false);}
 };
 if(!current.invoice||!current.annotationChoices)return null;
 const options=(rows:Array<{id:string;label:string}>,saved:{id:string;label:string}|null|undefined)=>saved&&!rows.some(row=>row.id===saved.id)?[{...saved,inactive:true},...rows.map(row=>({...row,inactive:false}))]:rows.map(row=>({...row,inactive:false}));
 return <section aria-label={C.title} className="kr-stapel"><h3>{C.title}</h3><div className="kr-form">
  <Feld label={C.remark+' · '+C.optional} voll><Textfeld value={remark} disabled={busy} maxLength={2000} onChange={event=>change(setRemark,event.target.value)}/></Feld>
  <Feld label={C.person+' · '+C.optional}><select disabled={busy} value={personId} onChange={event=>change(setPerson,event.target.value)}><option value="">{C.none}</option>{options(current.annotationChoices.persons,current.annotations?.person).map(row=><option key={row.id} value={row.id} disabled={row.inactive}>{row.label}{row.inactive?' · '+C.inactive:''}</option>)}</select></Feld>
  <Feld label={C.vehicle+' · '+C.optional}><select disabled={busy} value={vehicleId} onChange={event=>change(setVehicle,event.target.value)}><option value="">{C.none}</option>{options(current.annotationChoices.vehicles,current.annotations?.vehicle).map(row=><option key={row.id} value={row.id} disabled={row.inactive}>{row.label}{row.inactive?' · '+C.inactive:''}</option>)}</select></Feld>
 </div>{message?<p role="status">{message}</p>:null}{conflict?<Button text={C.reload} disabled={busy} onClick={()=>void reload()}/>:null}<Button text={busy?C.saving:C.save} art="erledigen" disabled={busy} onClick={()=>void save()}/></section>;
}
