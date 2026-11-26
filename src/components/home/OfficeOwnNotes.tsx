'use client';

import {useCallback,useEffect,useId,useRef,useState,useSyncExternalStore} from 'react';
import {readTodayOwnNoteAction,saveTodayOwnNotesAction} from '@/app/actions/today.actions';
import {readServerReachability,serverReachabilitySnapshot,subscribeServerReachability} from '@/lib/offline/serverReachability';
import {Button,Hinweis,Kachel} from '@/ui/kr';
import {PAGE_READ_COPY,TODAY_OWN_NOTE_COPY,V45_TEXT} from '@/ui/situationCatalog';
import styles from './OfficeOwnNotes.module.css';

type Note=Extract<Awaited<ReturnType<typeof readTodayOwnNoteAction>>,{code:'OK'}>['note'];
type SaveStatus='idle'|'saving'|'saved'|'failed'|'conflict'|'unavailable';

export function OfficeOwnNotes(){
 const field=useId();
 const online=useSyncExternalStore(subscribeServerReachability,readServerReachability,serverReachabilitySnapshot);
 const source=useRef<Note|null>(null);
 const current=useRef<string|null>(null);
 const mounted=useRef(false);
 const inFlight=useRef(false);
 const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const [note,setNote]=useState<Note|null>(null);
 const [draft,setDraft]=useState('');
 const [status,setStatus]=useState<SaveStatus>('idle');

 const reload=useCallback(async()=>{
  const result=await readTodayOwnNoteAction().catch(()=>({code:'UNAVAILABLE' as const}));
  if(!mounted.current)return;
  if(result.code!=='OK'){setStatus('unavailable');return;}
  source.current=result.note;
  setNote(result.note);
  if(current.current===null)setDraft(result.note.text);
  setStatus(current.current!==null?'failed':result.note.version>0&&!result.note.completed?'saved':'idle');
 },[]);

 useEffect(()=>{
  mounted.current=true;
  return ()=>{mounted.current=false;clearTimeout(timer.current);};
 },[]);
 useEffect(()=>{
  if(online&&!source.current)void reload();
 },[online,reload]);

 async function save(){
  clearTimeout(timer.current);
  const text=current.current?.trim(),base=source.current;
  if(!base||base.completed||!readServerReachability()||inFlight.current)return;
  if(!text){setStatus('failed');return;}
  if(text===base.text){current.current=null;setStatus(base.version>0?'saved':'idle');return;}
  inFlight.current=true;
  setStatus('saving');
  const result=await saveTodayOwnNotesAction({text,day:base.day,version:base.version}).catch(()=>({code:'UNAVAILABLE' as const}));
  inFlight.current=false;
  if(!mounted.current)return;
  if(result.code!=='OK'||result.note.day!==base.day||result.note.text!==text||result.note.version!==base.version+1){
   setStatus(result.code==='CONFLICT'?'conflict':'failed');
   return;
  }
  source.current=result.note;
  setNote(result.note);
  if(current.current?.trim()===text){current.current=null;setStatus('saved');}
  else if(current.current?.trim())void save();
  else setStatus('idle');
 }

 return <Kachel titel={TODAY_OWN_NOTE_COPY.title} icon="file" iconTon="info">
  {note?.completed?<Hinweis>{TODAY_OWN_NOTE_COPY.completed}</Hinweis>:<div className={styles.editor}>
   <label htmlFor={field} className={styles.label}>{TODAY_OWN_NOTE_COPY.title}</label>
   <textarea id={field} aria-describedby={field+'-status'} value={draft} maxLength={2000}
     placeholder={TODAY_OWN_NOTE_COPY.placeholder} disabled={!note&&online}
     onChange={event=>{
      current.current=event.currentTarget.value;
      setDraft(current.current);
      setStatus('idle');
      clearTimeout(timer.current);
      timer.current=setTimeout(()=>void save(),500);
     }}
     onBlur={()=>{if(current.current!==null&&status!=='conflict')void save();}}/>
   <span id={field+'-status'} role="status">
    {!online?V45_TEXT.offline$only:status==='unavailable'?PAGE_READ_COPY.sourceIncomplete:!note?PAGE_READ_COPY.loading:
     status==='saved'?TODAY_OWN_NOTE_COPY.saved:status==='failed'?TODAY_OWN_NOTE_COPY.failed:status==='conflict'?TODAY_OWN_NOTE_COPY.changed:null}
   </span>
   {online&&(status==='unavailable'||status==='conflict'||!note&&current.current!==null)&&
    <Button art="leise" text={PAGE_READ_COPY.reload} onClick={()=>void reload()}/>}
   {online&&status==='failed'&&<Button art="leise" text={V45_TEXT.common$retry} onClick={()=>void save()}/>}
  </div>}
 </Kachel>;
}
