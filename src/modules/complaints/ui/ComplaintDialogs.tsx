'use client';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {KrApp,useKrGeraet,Dialog,Picker,Button,Hinweis} from '@/ui/kr';
import {ComplaintDialog} from './ComplaintDialog';
import {COMPLAINT_CHANGED_EVENT,type ComplaintPorts,type ComplaintRequest} from '../dialogContract';

/** One mounted receiver for every complaint entry; no separate creation route. */
export function ComplaintDialogs({ports,onRefresh}:{ports:ComplaintPorts;onRefresh:()=>void}) {
  const [entry,setEntry]=useState<{key:string;request:ComplaintRequest}|null>(null),[message,setMessage]=useState<string|null>(null),device=useKrGeraet();
  const [customer,setCustomer]=useState<string|null>(null),[orders,setOrders]=useState<Array<{id:string;number:string;title:string}>>([]),[query,setQuery]=useState(''),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{if(!customer||!ports.listDeliveredOrders)return;let active=true;void ports.listDeliveredOrders(customer).then(result=>{if(!active)return;if(result.code==='OK'&&'orders'in result)setOrders(result.orders);else setError('message'in result?result.message:'Aufträge nicht verfügbar.');}).catch(cause=>{console.error('[COMPLAINT_PICKER_FAILED]',cause);if(active)setError('Gelieferte Aufträge konnten nicht geladen werden.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[customer,ports,attempt]);
  useEffect(()=>{
    const open=(event:Event)=>{
      const value=(event as CustomEvent<{ziel?:string;arg?:unknown}>).detail;
      if(value?.ziel!=='reklamation'||typeof value.arg!=='string'||!value.arg)return;
      const [id,mode]=value.arg.split('#',2);
      if(!id)return;
      if(mode==='kundenwahl'){event.preventDefault();setOrders([]);setQuery('');setLoading(true);setError(null);setCustomer(id);return;}
      event.preventDefault();setEntry({key:crypto.randomUUID(),request:mode?{orderId:id,...(mode!=='aufnehmen'?{sourceItemId:mode}:{})}:{complaintId:id}});
    };
    window.addEventListener('kreile:oeffne',open);
    return()=>window.removeEventListener('kreile:oeffne',open);
  },[]);
  return <>{customer&&typeof document!=='undefined'?createPortal(<KrApp geraet={device} portal><Dialog titel="Vorgang wählen" icon="list" groesse="breit" onSchliessen={()=>setCustomer(null)} fuss={<Button text="Schließen" onClick={()=>setCustomer(null)}/>}><p>Gelieferte Aufträge dieses Kunden · letzte 24 Monate</p>{error?<><Hinweis ton="warn">{error}</Hinweis><Button text="Erneut" onClick={()=>{setLoading(true);setError(null);setAttempt(value=>value+1);}}/></>:null}<Picker suche={query} onSuche={setQuery} zustand={loading?'laedt':error?'fehler':'daten'} optionen={orders.filter(order=>(order.number+' '+order.title).toLocaleLowerCase('de-DE').includes(query.toLocaleLowerCase('de-DE'))).map(order=>({id:order.number,titel:order.title,onWahl:()=>{setCustomer(null);setEntry({key:crypto.randomUUID(),request:{orderId:order.id}});}}))}/></Dialog></KrApp>,document.body):null}{message?<div role="status" className="kr-toast">{message}</div>:null}{entry&&typeof document!=='undefined'?createPortal(<KrApp geraet={device} portal><ComplaintDialog key={entry.key} request={entry.request} ports={ports} onClose={()=>setEntry(current=>current?.key===entry.key?null:current)} onMessage={text=>{setMessage(text);window.dispatchEvent(new Event(COMPLAINT_CHANGED_EVENT));onRefresh();}}/></KrApp>,document.body):null}</>;
}
