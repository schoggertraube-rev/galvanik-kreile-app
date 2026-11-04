'use client';
import {useCallback,useState,useSyncExternalStore,type MouseEvent} from 'react';
import {createPortal} from 'react-dom';
import {Button,Dialog,Hinweis,Icon,type Geraet} from '@/ui/kr';
import entries from '@/content/was-ist-neu.json';

const CHANGED='kreile:was-ist-neu-gelesen',UNAVAILABLE='__STORAGE_UNAVAILABLE__';
const fingerprint=(entry:typeof entries[number])=>JSON.stringify(entry);
const ordered=[...entries].sort((a,b)=>b.datum.localeCompare(a.datum)||b.pr-a.pr);
function readSeen(raw:string|null):string[]{if(!raw||raw===UNAVAILABLE)return [];try{const value:unknown=JSON.parse(raw);return Array.isArray(value)&&value.every(item=>typeof item==='string')?value:[];}catch(error){console.warn('[WHAT_NEW_MARKER_INVALID]',{code:error instanceof Error?error.name:'INVALID_MARKER'});return [];}}

/** UI reading history only. All release content comes from the one committed JSON source. */
export function WasIstNeu({loginHandle,geraet,onNavigate}:{loginHandle:string;geraet:Geraet;onNavigate:(path:string)=>boolean}){
 const key='kreile:was-ist-neu:'+loginHandle,[open,setOpen]=useState(false),[host,setHost]=useState<Element|null>(null),[memorySeen,setMemorySeen]=useState<string[]|null>(null),[writeUnavailable,setWriteUnavailable]=useState(false),[now]=useState(()=>Date.now()),[message,setMessage]=useState<string|null>(null);
 const subscribe=useCallback((notify:()=>void)=>{
  const onStorage=(event:StorageEvent)=>{if(event.key===key||event.key===null)notify();};
  window.addEventListener('storage',onStorage);window.addEventListener(CHANGED,notify);return()=>{window.removeEventListener('storage',onStorage);window.removeEventListener(CHANGED,notify);};
 },[key]);
 const snapshot=useCallback(()=>{try{return localStorage.getItem(key);}catch(error){console.warn('[WHAT_NEW_STORAGE_READ_FAILED]',{code:error instanceof Error?error.name:'STORAGE_UNAVAILABLE'});return UNAVAILABLE;}},[key]);
 const raw=useSyncExternalStore(subscribe,snapshot,()=>null),storageAvailable=raw!==UNAVAILABLE&&!writeUnavailable;
 const visible=storageAvailable?ordered:ordered.filter(entry=>Date.parse(entry.datum+'T00:00:00Z')>=now-7*86400000);
 const seen=!storageAvailable&&memorySeen?memorySeen:readSeen(raw),unread=visible.filter(entry=>!seen.includes(fingerprint(entry))).length;
 const show=(event:MouseEvent<HTMLButtonElement>)=>{
  // The shared Dialog is absolute within the actual full-height app root.
  // A second KrApp under body would place it below the visible app on older CSS.
  const root=event.currentTarget.closest('.kr-app');
  if(!root){console.error('[WHAT_NEW_APP_ROOT_MISSING]');setMessage('Die Änderungsliste konnte nicht geöffnet werden. Bitte die Seite neu laden.');return;}
  setHost(root);
  const values=visible.map(fingerprint);setOpen(true);setMessage(null);setMemorySeen(values);
  try{localStorage.setItem(key,JSON.stringify(values));window.dispatchEvent(new Event(CHANGED));}
  catch(error){setWriteUnavailable(true);console.warn('[WHAT_NEW_STORAGE_WRITE_FAILED]',{code:error instanceof Error?error.name:'STORAGE_UNAVAILABLE'});}
 };
 return <><button type="button" className="kr-btn kr-btn--leise" data-spec-id="app.was-ist-neu" aria-label={'Was ist neu'+(unread?' · '+unread+' ungelesen':'')} onClick={show}>
  <Icon name="file"/>{geraet!=='handy'?<span>Was ist neu</span>:null}{unread?<span className="kr-nav-badge" data-spec-id="app.was-ist-neu.anzahl">{unread}</span>:null}
 </button>{!open&&message?<Hinweis ton="warn">{message}</Hinweis>:null}
 {open&&host?createPortal(<Dialog titel="Was ist neu" icon="file" onSchliessen={()=>setOpen(false)} fuss={<Button text="Schließen" onClick={()=>setOpen(false)}/>}>
  <div data-spec-id="was-ist-neu" className="kr-stapel">{message?<Hinweis ton="warn">{message}</Hinweis>:null}{visible.length===0?<p>In den letzten sieben Tagen gibt es keine neuen Einträge.</p>:null}{visible.map(entry=><section key={entry.pr} className="kr-block"><h3>{new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(entry.datum+'T12:00:00Z'))} · #{entry.pr}</h3>
   {entry.punkte.map(point=><button type="button" key={point} className="kr-zeile" onClick={()=>{if(onNavigate(entry.ziel))setOpen(false);else setMessage('Dieser Punkt gehört zur Vorschau #'+entry.pr+' und ist in diesem Stand noch nicht freigegeben.');}}>{point}<Icon name="arrow"/></button>)}
  </section>)}</div>
 </Dialog>,host):null}</>;
}
