'use client';
import {useEffect,useRef,useState} from 'react';
import {Button,Icon,isTopDialog,useKrGeraet} from '@/ui/kr';
import type {AccessArea} from '@/lib/auth/authorizationContract';
import {intakeRequiredEffect} from '../intakeLifecycleContract';
import {concernOptions,type ConcernOption} from '../concernMenuContract';
import type {IntakeMessage} from '../messageContract';

export function ConcernMenu({message,areas,anchor,busy,error,onSelect,onInfo,onNoBusiness,onClose}:{message:IntakeMessage;areas:readonly AccessArea[];anchor:{x:number;y:number};busy:boolean;error:string|null;onSelect:(option:ConcernOption)=>void;onInfo:()=>void;onNoBusiness:()=>void;onClose:()=>void}){
 const required=intakeRequiredEffect(message.openConcerns);
 const [more,setMore]=useState(false),ref=useRef<HTMLElement>(null),device=useKrGeraet(),options=concernOptions(message,areas),ready=options.filter(value=>value.reason===null),other=options.filter(value=>value.reason!==null);
 useEffect(()=>{const previous=document.activeElement;ref.current?.querySelector<HTMLButtonElement>('button')?.focus();return()=>{if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};},[]);
 useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key!=='Escape'||!isTopDialog(ref.current))return;event.preventDefault();event.stopImmediatePropagation();if(!busy)onClose();};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[busy,onClose]);
 const position=device==='handy'?undefined:{left:Math.max(8,Math.min(anchor.x,window.innerWidth-348)),top:Math.max(8,Math.min(anchor.y,window.innerHeight-568))};
 return <div className="kr-ebene r51-m6-ebene" style={{pointerEvents:'auto'}} onClick={event=>{if(event.target===event.currentTarget&&!busy)onClose();}}>
  <section ref={ref} data-spec-id="anliegenwahl" className={'r51-m6'+(device==='handy'?' r51-m6--blatt':'')} style={position} role="dialog" aria-modal="true" aria-label="Anliegen wählen">
   <header className="r51-m6-kopf"><div><b>Anliegen wählen</b><small>{message.senderName??message.customerName??message.senderAddress??'Absender fehlt'} · {message.subject??'Betreff fehlt'}</small></div><Button data-spec-id="anliegenwahl.schliessen" art="leise" icon="x" label="Schließen" disabled={busy} onClick={onClose}/></header>
   {error?<div role="alert" className="kr-hinweis kr-hinweis--warn">{error}</div>:null}
   <div className="r51-m6-liste">{ready.length?ready.map(option=><button key={option.id} type="button" className="r51-m6-z" data-spec-id={'anliegenwahl.'+option.id} disabled={busy} onClick={()=>onSelect(option)}><Icon name={option.icon}/><span>{option.text}</span></button>):<p className="r51-m6-leer">Kein Anliegen passt direkt – unter „Anderes Anliegen wählen“ nachsehen oder als Info ablegen.</p>}
    <button type="button" className="r51-m6-weiter" data-spec-id="anliegenwahl.weitere" aria-expanded={more} onClick={()=>setMore(value=>!value)}><Icon name="chev"/><span>Anderes Anliegen wählen</span><em>{other.length}</em></button>
    {more?other.map(option=><button key={option.id} type="button" data-spec-id={'anliegenwahl.'+option.id} className="r51-m6-z r51-m6-z--aus" disabled><Icon name={option.icon}/><span>{option.text}<small>{option.reason}</small></span></button>):null}
   </div><footer className="r51-m6-fuss">{required?<span role="status">{required}</span>:<Button className="r51-m6-f" data-spec-id="anliegenwahl.nur_info" art="leise" text="Nur Info" disabled={busy} onClick={onInfo}/>}<Button className="r51-m6-f" data-spec-id="anliegenwahl.kein" art="leise" text="Kein Geschäftsvorgang" disabled={busy} onClick={onNoBusiness}/></footer>
  </section>
 </div>;
}
