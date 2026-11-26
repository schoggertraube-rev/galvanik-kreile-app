'use client';

import {useCallback,useEffect,useId,useRef,useState,useSyncExternalStore} from 'react';
import {readTodayOwnNoteAction,saveTodayOwnNotesAction} from '@/app/actions/today.actions';
import {readServerReachability,serverReachabilitySnapshot,subscribeServerReachability} from '@/lib/offline/serverReachability';
import {Button,Hinweis,Kachel} from '@/ui/kr';
import {PAGE_READ_COPY,TODAY_OWN_NOTE_COPY,V45_TEXT} from '@/ui/situationCatalog';
import styles from './OfficeOwnNotes.module.css';

type Note=Extract<Awaited<ReturnType<typeof readTodayOwnNoteAction>>,{code:'OK'}>['note'];
type SaveStatus='idle'|'saving'|'saved'|'failed'|'conflict'|'unavailable';
type NoteDraft={loginScope?:string;text:string;day:string|null;version:number|null;acknowledged?:true};

// Only the current login's pending edit survives an in-app navigation. It never
// enters the Today read model, storage or logs.
let retainedDraft:NoteDraft|null=null;
let outstandingSave:{loginScope:string;done:Promise<unknown>}|null=null;
const draftForLogin=(loginScope?:string)=>loginScope&&retainedDraft?.loginScope===loginScope?retainedDraft:null;

export function OfficeOwnNotes({loginScope}:{loginScope?:string}){
 const field=useId();
 const online=useSyncExternalStore(subscribeServerReachability,readServerReachability,serverReachabilitySnapshot);
 const [initialDraft]=useState(()=>draftForLogin(loginScope));
 const source=useRef<Note|null>(null);
 const current=useRef<NoteDraft|null>(initialDraft);
 const mounted=useRef(false);
 const inFlight=useRef(false);
 const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const [note,setNote]=useState<Note|null>(null);
 const [draft,setDraft]=useState(initialDraft?.text??'');
 const [status,setStatus]=useState<SaveStatus>('idle');

 const save=useCallback(async function saveDraft(){
  clearTimeout(timer.current);
  const submitted=current.current,base=source.current;
  if(!mounted.current||!submitted||!base||!readServerReachability()||inFlight.current)return;
  if(base.completed||(submitted.day!==null&&submitted.day!==base.day)||(submitted.version!==null&&submitted.version!==base.version)){
   setStatus('conflict');return;
  }
  const text=submitted.text.trim();
  if(!text){setStatus('failed');return;}
  inFlight.current=true;
  setStatus('saving');
  const done=saveTodayOwnNotesAction({text,day:base.day,version:base.version})
   .catch(()=>({code:'UNAVAILABLE' as const})).then(result=>{
    if(result.code!=='OK'||result.note.day!==base.day||result.note.text!==text||result.note.version!==base.version+1)
     return {code:result.code==='CONFLICT'?'conflict' as const:'failed' as const};
    submitted.acknowledged=true;
    if(retainedDraft===submitted)retainedDraft=null;
    const next=loginScope?draftForLogin(loginScope):current.current;
    if(next&&next!==submitted&&next.day===base.day&&next.version===base.version)next.version=result.note.version;
    return result;
   });
  const attempt=loginScope?{loginScope,done}:null;
  if(attempt)outstandingSave=attempt;
  const result=await done;
  if(outstandingSave===attempt)outstandingSave=null;
  inFlight.current=false;
  if(!mounted.current)return;
  if(result.code!=='OK'){setStatus(result.code);return;}
  source.current=result.note;
  setNote(result.note);
  if(current.current===submitted){current.current=null;setStatus('saved');}
  else if(current.current)void saveDraft();
 },[loginScope]);

 const reload=useCallback(async(resume=false)=>{
  const prior=outstandingSave;
  if(loginScope&&prior?.loginScope===loginScope)await prior.done;
  if(!mounted.current)return;
  const result=await readTodayOwnNoteAction().catch(()=>({code:'UNAVAILABLE' as const}));
  if(!mounted.current)return;
  if(result.code!=='OK'){setStatus('unavailable');return;}
  source.current=result.note;
  setNote(result.note);
  if(current.current?.acknowledged)current.current=null;
  if(!current.current){
   setDraft(result.note.text);
   setStatus(result.note.version>0&&!result.note.completed?'saved':'idle');
  }else if(resume){
   void save();
  }else{
   current.current.day=result.note.day;
   current.current.version=result.note.version;
   setStatus('failed');
  }
 },[loginScope,save]);

 useEffect(()=>{
  mounted.current=true;
  if(retainedDraft&&retainedDraft.loginScope!==loginScope)retainedDraft=null;
  return ()=>{mounted.current=false;clearTimeout(timer.current);};
 },[loginScope]);
 useEffect(()=>{
  if(online&&!source.current)void reload(true);
 },[online,reload]);

 return <Kachel titel={TODAY_OWN_NOTE_COPY.title} icon="file" iconTon="info">
  {note?.completed&&status==='idle'?<Hinweis>{TODAY_OWN_NOTE_COPY.completed}</Hinweis>:<div className={styles.editor}>
   <label htmlFor={field} className={styles.label}>{TODAY_OWN_NOTE_COPY.title}</label>
   <textarea id={field} aria-describedby={field+'-status'} value={draft} maxLength={2000}
     placeholder={TODAY_OWN_NOTE_COPY.placeholder} disabled={note?.completed===true||!note&&online}
     onChange={event=>{
      const text=event.currentTarget.value;
      current.current={loginScope,text,day:source.current?.day??current.current?.day??null,version:source.current?.version??current.current?.version??null};
      if(loginScope)retainedDraft=current.current;
      setDraft(text);
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
