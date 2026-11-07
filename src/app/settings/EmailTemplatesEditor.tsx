'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {readEmailTemplatesAction,saveEmailTemplateAction} from '@/app/actions/settings.actions';
import {Rueckfrage} from '@/ui/kr';
import type {StoredEmailTemplate} from '@/lib/email/templateContract';

export function EmailTemplatesEditor(){
 const [rows,setRows]=useState<StoredEmailTemplate[]|null>(null),[current,setCurrent]=useState<StoredEmailTemplate|null>(null),[message,setMessage]=useState<string|null>(null),[busy,setBusy]=useState(false),[unclear,setUnclear]=useState(false),[confirm,setConfirm]=useState(false);
 const next=useRef<null|(()=>void)>(null);
 const working=useRef(false),pending=useRef<null|{id:string;clientKey:string;updatedAt:string;subject:string;body:string}>(null);
 const load=useCallback(async()=>{
  if(working.current)return;working.current=true;setBusy(true);
  try{const result=await readEmailTemplatesAction();if(result.code!=='OK'){setMessage(result.message);return;}setRows(result.templates);setCurrent(result.templates[0]??null);pending.current=null;setUnclear(false);setMessage(null);}
  catch(error){console.error('[EMAIL_TEMPLATE_EDITOR_READ_FAILED]',error);setMessage('Mailvorlagen konnten nicht geladen werden.');}
  finally{working.current=false;setBusy(false);}
 },[]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
 const stored=rows?.find(row=>row.id===current?.id),dirty=Boolean(current&&stored&&(current.subject!==stored.subject||current.body!==stored.body));
 useEffect(()=>{if(!dirty&&!unclear)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty,unclear]);
 const navigate=(action:()=>void)=>{if(dirty){next.current=action;setConfirm(true);}else action();};
 const save=async()=>{
  if(working.current||!current)return;
  if(!current.subject.trim()||!current.body?.trim()){setMessage('Betreff und Nachricht fehlen.');return;}
  const input=pending.current??{id:current.id,clientKey:crypto.randomUUID(),updatedAt:current.updatedAt,subject:current.subject,body:current.body??''};
  pending.current=input;working.current=true;setBusy(true);setMessage(null);
  try{const result=await saveEmailTemplateAction(input);if(result.code!=='OK'){setMessage(result.message);setUnclear(result.code==='UNAVAILABLE');if(result.code!=='UNAVAILABLE')pending.current=null;return;}
   setCurrent(result.template);setRows(items=>items?.map(item=>item.id===result.template.id?result.template:item)??null);pending.current=null;setUnclear(false);setMessage('Mailvorlage gespeichert.');
  }catch(error){console.error('[EMAIL_TEMPLATE_EDITOR_WRITE_FAILED]',error);setUnclear(true);setMessage('Speicherergebnis unklar · Eingaben bleiben erhalten. Erneut speichern prüft denselben Vorgang.');}
  finally{working.current=false;setBusy(false);}
 };
 return <><section aria-label="Mailvorlagen"><h3>Mailvorlagen</h3>{message?<p role="status">{message}</p>:null}{rows===null?<button disabled={busy} onClick={()=>void load()}>{busy?'Wird geladen …':'Erneut laden'}</button>:!rows.length?<p>Keine Mailvorlagen vorhanden.</p>:<>
  <label>Vorlage<select disabled={busy||unclear} value={current?.id??''} onChange={event=>{const id=event.target.value;navigate(()=>{setCurrent(rows.find(row=>row.id===id)??null);pending.current=null;setMessage(null);});}}>{rows.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
  {current?<><label>Betreff<input value={current.subject} maxLength={500} disabled={busy||unclear} onChange={event=>setCurrent({...current,subject:event.target.value})}/></label><label>Nachricht<textarea value={current.body??''} maxLength={20000} disabled={busy||unclear} onChange={event=>setCurrent({...current,body:event.target.value})}/></label>{current.key.endsWith(':reklamation_ergebnis')?<p>Platzhalter: {'{Kunde} · {RK-Nummer} · {Ergebnis} · {Begründung}'}</p>:null}<button disabled={busy} onClick={()=>void save()}>{busy?'Wird gespeichert …':unclear?'Erneut speichern':'Mailvorlage speichern'}</button><button disabled={busy||unclear} onClick={()=>navigate(()=>void load())}>Neu laden</button></>:null}
 </>}</section>{confirm?<Rueckfrage felder={['Mailvorlage']} beschaeftigt={busy} onWeiter={()=>{next.current=null;setConfirm(false);}} onVerwerfen={()=>{const action=next.current;next.current=null;setConfirm(false);action?.();}}/>:null}</>;
}
