'use client';
import{useCallback,useEffect,useRef,useState}from'react';
import{Button,Dialog,Feld,Eingabe,Textfeld,Segment,FormRaster,Hinweis,Rueckfrage}from'@/ui/kr';
import{ACCESS_AREAS,type AccessArea}from'@/lib/auth/authorizationContract';
import{TASK_KINDS,TASK_KIND_LABELS,taskValidation,type TaskKind,type TaskOpenRequest,type TaskReadResult,type TaskResult,type TaskSaveInput,type TaskCompleteInput,type TaskReferenceRead,type TaskReferenceType}from'../contract';

export type TaskPorts={read:(request:TaskOpenRequest)=>Promise<TaskReadResult>;save:(input:TaskSaveInput)=>Promise<TaskResult>;complete:(input:TaskCompleteInput)=>Promise<TaskResult>;canManageMoney:boolean;referenceTargets:readonly TaskReferenceType[];openReference:(reference:TaskReferenceRead)=>void;openInvoice?:(id:string)=>void};
type Data=Extract<TaskReadResult,{code:'OK'}>;
type Draft={kind:TaskKind;title:string;dueDate:string;time:string;recipient:string;note:string};
const AREA_NAMES:Record<AccessArea,string>={auftraege:'Aufträge',eingang:'Eingang',kunden:'Kunden',geld:'Geld',kassieren:'Kassieren',mails:'Nachrichten',entscheiden:'Entscheiden',einstellungen:'Einstellungen',logins:'Logins',wartung:'Wartung'};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dateLabel=(date:string)=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(date+'T12:00:00Z')).replace(/^(\p{L}+)\.,?\s/u,'$1 ');
function initial(data:Data,request:TaskOpenRequest):Draft{
 const task=data.task,kind=task?.art??('kind'in request?request.kind:undefined)??'aufgabe';
 return {kind,title:task?.titel??(kind==='aufgabe'?'':TASK_KIND_LABELS[kind]+(data.reference.label?' '+data.reference.label:'')),dueDate:task?.faellig_am??today(),time:task?.uhrzeit??'',recipient:task?.fuer_bereich?'bereich:'+task.fuer_bereich:task?.fuer_login&&task.fuer_login!==data.currentLogin?'login:'+task.fuer_login:task?'ich':kind==='frist'||kind==='rechnung'?'bereich:geld':'ich',note:task?.notiz??''};
}
export function TaskDialog({request,ports,onClose,onMessage}:{request:TaskOpenRequest;ports:TaskPorts;onClose:()=>void;onMessage:(message:string)=>void}){
 const[data,setData]=useState<Data|null>(null),[draft,setDraft]=useState<Draft|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[gaps,setGaps]=useState<Record<string,string>>({}),[closePrompt,setClosePrompt]=useState(false);
 const[baseline,setBaseline]=useState<Draft|null>(null),clientKey=useRef(crypto.randomUUID()),working=useRef(false),lastField=useRef<string|null>(null),pending=useRef<{command:'save';input:TaskSaveInput}|{command:'complete';input:TaskCompleteInput}|null>(null);
 const load=useCallback(async()=>{
  setLoading(true);setError(null);
  try{const result=await ports.read(request);if(result.code!=='OK'){setError(result.message);return;}const value=initial(result,request);setBaseline(value);if(result.task)clientKey.current=result.task.client_key;setData(result);setDraft(value);}
  catch(cause){console.error('[TASK_DIALOG_READ_FAILED]',cause);setError('Aufgabe nicht ladbar · Fehlercode: TASK_DIALOG_READ_FAILED.');}
  finally{setLoading(false);}
 },[ports,request]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
 const dirty=!!draft&&JSON.stringify(draft)!==JSON.stringify(baseline);
 const close=()=>{if(working.current)return;if(dirty){setClosePrompt(true);return;}onClose();};
 const change=(patch:Partial<Draft>)=>{if(working.current||pending.current)return;setDraft(value=>value?{...value,...patch}:value);setGaps({});setError(null);};
 const input=():TaskSaveInput|null=>{
  if(!data||!draft)return null;
  const itemId=data.task?.item_id??('itemId'in request?request.itemId:undefined);
  return {clientKey:clientKey.current,...(data.task?{taskId:data.task.id}:{}),version:data.task?.version??0,kind:draft.kind,title:draft.title,dueDate:draft.dueDate,time:draft.time||null,
   forLogin:draft.recipient==='ich'?data.currentLogin:draft.recipient.startsWith('login:')?draft.recipient.slice(6):null,forArea:draft.recipient.startsWith('bereich:')?draft.recipient.slice(8) as AccessArea:null,
   reference:{type:data.reference.type,id:data.reference.id},note:draft.note||null,...(itemId?{itemId,...(!data.task&&data.reference.sourceVersion?{itemVersion:data.reference.sourceVersion}:{})}:{})};
 };
 const focus=(field:string)=>{const ids:Record<string,string>={title:'titel',dueDate:'faellig',recipient:'fuer',kind:'art',time:'uhrzeit',note:'notiz'};requestAnimationFrame(()=>{const element=document.querySelector<HTMLElement>('[data-spec-id="aufgabe.'+(ids[field]??'titel')+'"]');element?.scrollIntoView({block:'nearest'});element?.focus();});};
 const perform=async(command:'save'|'complete')=>{
  if(working.current||!data||!draft)return;
  if(!pending.current){
   if(command==='save'){
    const payload=input();if(!payload)return;const fields=taskValidation(payload);if(Object.keys(fields).length){setGaps(fields);focus(Object.keys(fields)[0]);return;}
    pending.current={command,input:payload};
   }else{
    if(!data.task||!data.canComplete)return;
    if(baseline&&Object.entries(draft).some(([key,value])=>key!=='note'&&value!==baseline[key as keyof Draft])){setError('Änderungen zuerst speichern · Eingaben bleiben erhalten.');return;}
    pending.current={command,input:{taskId:data.task.id,version:data.task.version,note:draft.note.trim()||null}};
   }
  }
  working.current=true;setBusy(true);setError(null);const operation=pending.current;
  try{
   const result=operation.command==='save'?await ports.save(operation.input):await ports.complete(operation.input);
   if(result.code!=='OK'){setError('Nicht gespeichert · Eingaben sind noch da · '+result.message);if(result.fields)setGaps(result.fields);pending.current=null;return;}
   const reread=await ports.read({taskId:result.task.id});
   if(reread.code!=='OK'||!reread.task||reread.task.version!==result.task.version||reread.task.status!==result.task.status){setError('Nicht gespeichert oder noch nicht sicher gelesen · Eingaben sind noch da. Fehlercode: TASK_DIALOG_READBACK_FAILED.');return;}
   pending.current=null;setBaseline(draft);
   onMessage(operation.command==='complete'?'Erledigt · steht im Verlauf':data.task?'Aufgabe gespeichert':'Aufgabe auf Der Tag · fällig '+dateLabel(result.task.faellig_am));onClose();
  }catch(cause){console.error('[TASK_DIALOG_WRITE_FAILED]',cause);setError('Nicht gespeichert · Eingaben sind noch da. Fehlercode: TASK_DIALOG_WRITE_FAILED.');}
  finally{working.current=false;setBusy(false);}
 };
 const readonly=busy||!data?.canEdit;
 const required=(text:string)=><>{text} <small className="ev-pflicht" aria-hidden="true">Pflicht</small></>;
 const changed=dirty?Object.keys(draft??{}).filter(key=>draft?.[key as keyof Draft]!==baseline?.[key as keyof Draft]).map(key=>({kind:'Art',title:'Was ist zu tun?',dueDate:'Fällig',time:'Uhrzeit',recipient:'Für',note:'Notiz'})[key as keyof Draft]):[];
 const continueEditing=()=>{setClosePrompt(false);requestAnimationFrame(()=>{if(lastField.current)document.querySelector<HTMLElement>('[data-spec-id="'+lastField.current+'"]')?.focus();});};
 return <><Dialog titel="Aufgabe" icon="check" groesse="schmal" unterzeile={draft?.kind!=='aufgabe'&&draft?TASK_KIND_LABELS[draft.kind]:undefined} schliessenSpecId="aufgabe.schliessen" onSchliessen={close} vorSchliessen={()=>{close();return false;}} fuss={<>
  <Button text="Abbrechen" data-spec-id="aufgabe.abbrechen" onClick={close}/>
  {draft?.kind==='rueckruf'&&data?.reference.phone?<a className="kr-btn" data-spec-id="aufgabe.anrufen" href={'tel:'+data.reference.phone}>Anrufen</a>:null}
  {data?.task&&data.canEdit?<Button text={busy?'Wird gespeichert …':'Speichern'} data-spec-id="aufgabe.aendern-speichern" onClick={()=>void perform('save')}/>:null}
  {data?.task?.art==='rechnung'&&ports.canManageMoney?<Button text="Klären" icon="check" art="erledigen" disabled={!ports.openInvoice||busy} data-spec-id="aufgabe.rechnung-klaeren" onClick={()=>{if(data.task?.bezug_typ==='eingangsrechnung'&&data.task.bezug_id)ports.openInvoice?.(data.task.bezug_id);}}/>:data?.canComplete?<Button text={busy?'Wird gespeichert …':'Erledigt'} icon="check" art="erledigen" data-spec-id="aufgabe.erledigt" onClick={()=>void perform('complete')}/>:data&&!data.task?<Button text={busy?'Wird gespeichert …':'Auf Der Tag'} icon="check" art="erledigen" data-spec-id="aufgabe.speichern" onClick={()=>void perform('save')}/>:null}
 </>}><div data-spec-id="aufgabe" className="kr-stapel" onFocusCapture={event=>{const id=(event.target as HTMLElement).closest<HTMLElement>('[data-spec-id]')?.dataset.specId;if(id&&id!=='aufgabe')lastField.current=id;}}>
  {loading?<p role="status">Aufgabe wird geladen …</p>:null}
  {data&&draft?<><Feld label={required('Art')}><div data-spec-id="aufgabe.art"><Segment label="Art" wert={draft.kind} optionen={TASK_KINDS.filter(kind=>kind!=='rechnung'||ports.canManageMoney||draft.kind==='rechnung').map(kind=>({wert:kind,text:TASK_KIND_LABELS[kind],gesperrt:readonly||data.task?.art==='rechnung'||kind==='rechnung'}))} onWert={kind=>change({kind,recipient:kind==='frist'?'bereich:geld':'ich'})}/></div></Feld>
   <FormRaster><Feld label={required('Was ist zu tun?')} fehler={gaps.title}><Eingabe data-spec-id="aufgabe.titel" value={draft.title} maxLength={120} disabled={readonly} onChange={event=>change({title:event.target.value})}/></Feld>
    <Feld label={required('Fällig')} fehler={gaps.dueDate}><Eingabe data-spec-id="aufgabe.faellig" type="date" value={draft.dueDate} disabled={readonly} onChange={event=>change({dueDate:event.target.value})}/></Feld>
    {draft.kind==='rueckruf'?<Feld label="Uhrzeit" fehler={gaps.time}><Eingabe data-spec-id="aufgabe.uhrzeit" type="time" value={draft.time} disabled={readonly} onChange={event=>change({time:event.target.value})}/></Feld>:null}
    <Feld label={required('Für')} fehler={gaps.recipient}><select className="kr-auswahl" data-spec-id="aufgabe.fuer" value={draft.recipient} disabled={readonly} onChange={event=>change({recipient:event.target.value})}>
     <option value="ich">ich</option>{ACCESS_AREAS.map(area=><option key={area} value={'bereich:'+area}>alle mit Recht {AREA_NAMES[area]}</option>)}{draft.recipient.startsWith('login:')?<option value={draft.recipient}>Login {draft.recipient.slice(6)}</option>:null}
    </select></Feld>
   </FormRaster>
   <div><b>Bezug</b><p data-spec-id="aufgabe.bezug">{data.canOpenReference&&ports.referenceTargets.includes(data.reference.type)?<button type="button" className="kr-link" onClick={()=>ports.openReference(data.reference)}>{data.reference.label??'Bezeichnung fehlt'}</button>:data.reference.type==='allgemein'?'allgemein':data.reference.label??'Bezug nicht verfügbar'}</p></div>
   {data.task?.art==='rechnung'&&!ports.openInvoice?<Hinweis ton="warn">Eingangsrechnung nicht verfügbar · Fehlercode: TASK_INVOICE_NOT_AVAILABLE.</Hinweis>:null}
   <Feld label="Notiz" fehler={gaps.note}><Textfeld data-spec-id="aufgabe.notiz" value={draft.note} maxLength={2000} rows={3} disabled={readonly} onChange={event=>change({note:event.target.value})}/></Feld>
   {data.task?.status==='erledigt'?<Hinweis ton="ok">Erledigt · {data.task.erledigt_notiz??'ohne zusätzliche Notiz'}</Hinweis>:null}
  </>:null}
  {Object.keys(gaps).length?<div data-spec-id="aufgabe.zustand.teilweise" role="alert"><Hinweis ton="warn">Noch offen: {Object.values(gaps).join(' · ')}</Hinweis><Button text="Zur Lücke" data-spec-id="aufgabe.zur-luecke" onClick={()=>{const first=Object.keys(gaps)[0];setGaps({});focus(first);}}/></div>:null}
  {error?<div data-spec-id="aufgabe.zustand.fehler" role="alert"><Hinweis ton="warn">{error}</Hinweis><Button text="Erneut" data-spec-id="aufgabe.erneut" onClick={()=>{if(working.current)return;if(data)setError(null);else void load();}}/></div>:null}
 </div></Dialog>
 {closePrompt?<Rueckfrage felder={changed} hauptaktion={data?.canEdit?{text:'Speichern',lauftext:'Wird gespeichert …',ausfuehren:()=>void perform('save')}:undefined} beschaeftigt={busy} fehler={error} onWeiter={continueEditing} onVerwerfen={()=>{pending.current=null;onMessage('Änderungen verworfen');onClose();}}/>:null}
 </>;
}
