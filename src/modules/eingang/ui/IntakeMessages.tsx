'use client';
import {useCallback,useEffect,useMemo,useRef,useState,type MouseEvent,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Button,Dialog,Hinweis,Icon,KrApp,useKrGeraet} from '@/ui/kr';
import {MESSAGE_FILTERS,INTAKE_CHANGED_EVENT,messageGroupId,messageTone,type MessageFilter,type IntakeMessage,type IntakeMessagesPorts,type IntakeMessagesResult} from '../messageContract';
import {concernOptions,type ConcernOption} from '../concernMenuContract';
import {ConcernMenu} from './ConcernMenu';
import {IntakeConcernsPanel} from './IntakeConcernsPanel';
import concernStyles from './IntakeConcernsPanel.module.css';
import type {TaskOpenRequest} from '@/modules/tasks/public';
import type {AssignmentReadResult} from '../assignmentContract';

const FILTER_LABELS:Record<MessageFilter,string>={offen:'Offen',zuordnen:'Zuordnen',alle:'Alle',erledigt:'Erledigt',aussortiert:'Aussortiert'};
const CONCERN_FILTERS=[['reklamation','Rekla'],['kv_anfrage','KV'],['nachfrage','Nachfrage'],['termin','Termin'],['zahlung','Zahlung'],['ware','Ware'],['rechnung','Rechnung'],['rueckruf','Rückruf'],['lieferant','Lieferanten']] as const;
function time(at:string){return new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Berlin'}).format(new Date(at));}
function open(ziel:string,arg:string,extra:Record<string,unknown>={}){return window.dispatchEvent(new CustomEvent('kreile:oeffne',{detail:{ziel,arg,...extra},cancelable:true}));}
type Group={id:string;name:string;rows:IntakeMessage[];open:number;tone:ReturnType<typeof messageTone>;at:string;unassigned:boolean};

/** The same conversation component is used by the route and the existing navigation bus. */
export function IntakeMessages({ports,initialGroup,onClose}:{ports:IntakeMessagesPorts;initialGroup?:string;onClose?:()=>void}){
 const [tab,setTab]=useState<'mail'|'concerns'>('mail');
 const changeTab=(next:'mail'|'concerns')=>setTab(next);
 const [filter,setFilter]=useState<MessageFilter>(initialGroup?'alle':'offen'),[concernFilter,setConcernFilter]=useState<string|null>(null),[result,setResult]=useState<Extract<IntakeMessagesResult,{code:'OK'}>|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null),[selected,setSelected]=useState<string|null>(initialGroup??null),[menu,setMenu]=useState<{id:string;x:number;y:number}|null>(null),[busy,setBusy]=useState(false),[toast,setToast]=useState<string|null>(null),[retry,setRetry]=useState<(()=>void)|null>(null),[reopening,setReopening]=useState<IntakeMessage|null>(null),[reason,setReason]=useState('');
 const effectiveFilter:MessageFilter=tab==='concerns'?'alle':filter;
 const device=useKrGeraet(),inFlight=useRef(false),keys=useRef(new Map<string,string>()),longPress=useRef<ReturnType<typeof setTimeout>|null>(null),requestId=useRef(0);
 const[assignments,setAssignments]=useState<Record<string,{version:number;result:AssignmentReadResult}>>({}),assignmentRequests=useRef(new Set<string>());
 const[reopenInvalid,setReopenInvalid]=useState(false),[writeError,setWriteError]=useState<string|null>(null);
 const key=(operation:string,row:IntakeMessage)=>{const id=operation+':'+row.id+':'+row.version;if(!keys.current.has(id))keys.current.set(id,crypto.randomUUID());return keys.current.get(id)!;};
 const load=useCallback(async(signal?:AbortSignal)=>{const request=++requestId.current;setLoading(true);setError(null);try{const read=await ports.list(effectiveFilter);if(request!==requestId.current||signal?.aborted)return;if(read.code!=='OK'){setError(read.message);return;}setResult(read);}catch(failure){console.error('[INTAKE_MESSAGES_UI_READ_FAILED]',failure);if(request===requestId.current&&!signal?.aborted)setError('Nachrichten konnten nicht geladen werden · Code: INTAKE_MESSAGES_UI_READ_FAILED.');}finally{if(request===requestId.current&&!signal?.aborted)setLoading(false);}},[ports,effectiveFilter]);
 useEffect(()=>{const controller=new AbortController(),timer=setTimeout(()=>void load(controller.signal),0);return()=>{clearTimeout(timer);controller.abort();};},[load]);
 useEffect(()=>{const changed=()=>void load();window.addEventListener(INTAKE_CHANGED_EVENT,changed);return()=>window.removeEventListener(INTAKE_CHANGED_EVENT,changed);},[load]);
 useEffect(()=>{return()=>{if(longPress.current)clearTimeout(longPress.current);};},[]);
 const groups=useMemo(()=>{
  const map=new Map<string,Group>(),rank={rot:0,orange:1,navy:2,gruen:3};
  for(const row of result?.messages??[]){const id=messageGroupId(row),tone=messageTone(row),current=map.get(id);if(current){current.rows.push(row);current.open+=row.openConcerns.length;current.unassigned||=row.assignment==='offen'&&row.direction==='rein';if(rank[tone]<rank[current.tone])current.tone=tone;if(row.usage==='offen'&&row.at<current.at)current.at=row.at;}
   else map.set(id,{id,name:row.customerName??row.senderName??row.senderAddress??'Absender fehlt',rows:[row],open:row.openConcerns.length,tone,at:row.at,unassigned:row.assignment==='offen'&&row.direction==='rein'});}
  return [...map.values()].sort((a,b)=>filter==='erledigt'?b.at.localeCompare(a.at):Number(b.unassigned)-Number(a.unassigned)||rank[a.tone]-rank[b.tone]||a.at.localeCompare(b.at));
 },[result,filter]);
 const counts=CONCERN_FILTERS.map(([id,label])=>({id,label,count:groups.filter(group=>group.rows.some(row=>id==='lieferant'?row.customerType==='lieferant':row.openConcerns.some(value=>id==='kv_anfrage'?['kv_anfrage','kv_annahme','kv_ablehnung'].includes(value):value===id))).length}));
 const visible=concernFilter?groups.filter(group=>group.rows.some(row=>concernFilter==='lieferant'?row.customerType==='lieferant':row.openConcerns.some(value=>concernFilter==='kv_anfrage'?['kv_anfrage','kv_annahme','kv_ablehnung'].includes(value):value===concernFilter))):groups;
 const current=visible.find(group=>group.id===selected||group.rows.some(row=>row.id===selected||row.customerId===selected))??(selected===null?visible[0]:undefined),menuMessage=current?.rows.find(row=>row.id===menu?.id);
 const readAssignment=useCallback((row:IntakeMessage)=>{
  const request=row.id+':'+row.version;if(assignmentRequests.current.has(request))return;assignmentRequests.current.add(request);
  // Both success and synchronous port errors settle after the effect, never inside it.
  return Promise.resolve().then(()=>ports.assignment.read({itemId:row.id,mode:'normal'}))
   .then(read=>setAssignments(previous=>({...previous,[row.id]:{version:row.version,result:read}})))
   .catch(failure=>{console.error('[INTAKE_MESSAGES_ASSIGNMENT_READ_FAILED]',failure);setAssignments(previous=>({...previous,[row.id]:{version:row.version,result:{code:'UNAVAILABLE',message:'Zuordnung konnte nicht gelesen werden · Code: INTAKE_MESSAGES_ASSIGNMENT_READ_FAILED.'}}}));})
   .finally(()=>assignmentRequests.current.delete(request));
 },[ports]);
 useEffect(()=>{for(const row of current?.rows??[])if(row.assignment==='offen'&&row.direction==='rein'&&assignments[row.id]?.version!==row.version)void readAssignment(row);},[current,assignments,readAssignment]);
 const fail=(message:string,again?:()=>void)=>{setWriteError('Nicht gespeichert · '+message);setRetry(again?()=>again:null);};
 const confirmAssignment=async(row:IntakeMessage,customerId:string)=>{
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError(null);setWriteError(null);setRetry(null);
  try{const saved=await ports.assignment.assign({itemId:row.id,version:row.version,clientEventId:key('assign:'+customerId,row),customerId,mode:'confirm'});
   if(saved.code!=='OK'){fail(saved.code==='ALREADY_ASSIGNED'?'Eingang ist bereits zugeordnet.':saved.message,()=>void confirmAssignment(row,customerId));return;}
   setToast('Zugeordnet'+(saved.additional?' · '+saved.additional+' weitere von Adresse':''));setSelected(saved.customer.id);await load();
  }catch(failure){console.error('[INTAKE_MESSAGES_ASSIGNMENT_WRITE_FAILED]',failure);fail('Code: INTAKE_MESSAGES_ASSIGNMENT_WRITE_FAILED.',()=>void confirmAssignment(row,customerId));}
  finally{inFlight.current=false;setBusy(false);}
 };
 const differentAssignment=(row:IntakeMessage)=>{if(open('mailein',row.id,{sourceChannel:row.channel}))fail('Zuordnung konnte nicht geöffnet werden · Nachricht bleibt unverändert. Code: INTAKE_ASSIGNMENT_TARGET_NOT_MOUNTED.');};
 const finish=async(row:IntakeMessage,kind:'info'|'erledigt')=>{
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError(null);setWriteError(null);setRetry(null);
  try{const saved=await ports.finish({items:[{itemId:row.id,version:row.version}],kind,note:null,clientEventId:key(kind,row)});if(saved.code!=='OK'){fail(saved.message,()=>void finish(row,kind));return;}setMenu(null);setToast(kind==='info'?'Als Info vermerkt':'Erledigt');await load();}
  catch(failure){console.error('[INTAKE_MESSAGES_FINISH_FAILED]',failure);fail('Code: INTAKE_MESSAGES_FINISH_FAILED.',()=>void finish(row,kind));}finally{inFlight.current=false;setBusy(false);}
 };
 const choose=async(row:IntakeMessage,option:ConcernOption)=>{
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError(null);setWriteError(null);setRetry(null);
  try{const saved=await ports.select({itemId:row.id,version:row.version,concern:option.concern,clientEventId:key('select:'+option.concern,row)});if(saved.code!=='OK'){fail(saved.message,()=>void choose(row,option));return;}
   await load();
   if(option.target==='aufgabe'){
    const request={reference:{type:'eingang',id:row.id},kind:option.concern,itemId:row.id};
    if(open('aufgabe',row.id+'#'+option.concern,{taskRequest:request})){fail('Aufgabe konnte nicht geöffnet werden · Anliegen bleibt offen. Code: TASK_TARGET_NOT_MOUNTED.');return;}
   }else if(open(option.target,option.target==='eingang'||option.target==='rechnungein'?row.id:(row.orderId??'')+'#'+row.id,option.target==='eingang'?{sourceItemId:row.id}:{})){
    fail('Ziel konnte nicht geöffnet werden · Anliegen bleibt offen. Code: INTAKE_CONCERN_TARGET_NOT_MOUNTED.');return;
   }
   setMenu(null);
  }catch(failure){console.error('[INTAKE_MESSAGES_SELECT_FAILED]',failure);fail('Code: INTAKE_MESSAGES_SELECT_FAILED.',()=>void choose(row,option));}finally{inFlight.current=false;setBusy(false);}
 };
 const showMenu=(row:IntakeMessage,event:MouseEvent<HTMLElement>)=>{event.preventDefault();setError(null);setMenu({id:row.id,x:event.clientX,y:event.clientY});};
 const noBusiness=(row:IntakeMessage)=>{if(open('mailein',row.id+'#kein',{sourceChannel:row.channel}))fail('Zuordnung konnte nicht geöffnet werden · Nachricht bleibt unverändert. Code: INTAKE_ASSIGNMENT_TARGET_NOT_MOUNTED.');else setMenu(null);};
 const taskFromConversation=(row:IntakeMessage)=>{
  const taskRequest:TaskOpenRequest={reference:row.customerId?{type:'kunde',id:row.customerId}:row.orderId?{type:'auftrag',id:row.orderId}:{type:'eingang',id:row.id},kind:'aufgabe'};
  if(open('aufgabe',taskRequest.reference.id+'#aufgabe',{taskRequest}))fail('Aufgabe konnte nicht geöffnet werden · Gespräch bleibt unverändert. Code: TASK_TARGET_NOT_MOUNTED.');
 };
 const reopen=async()=>{if(!reopening||inFlight.current)return;const row=reopening;inFlight.current=true;setBusy(true);setError(null);setReopenInvalid(false);try{const saved=await ports.reopen({itemId:row.id,version:row.version,reason,clientEventId:key('reopen:'+reason,row)});if(saved.code!=='OK'){setReopenInvalid(saved.code==='VALIDATION_ERROR');fail(saved.message);return;}setReopening(null);setReason('');setToast('Wieder offen');await load();}catch(failure){console.error('[INTAKE_MESSAGES_REOPEN_FAILED]',failure);fail('Code: INTAKE_MESSAGES_REOPEN_FAILED.');}finally{inFlight.current=false;setBusy(false);}};
 const renderRows=(group:Group):ReactNode=><div className="ev-gespraech"><header className="ev-g-gkopf"><div><b>{group.name}</b><small>{group.rows[0].senderAddress??'Adresse fehlt'}</small></div>{device==='handy'?<Button art="leise" text="Zurück" onClick={()=>setSelected(null)}/>:null}</header><div className="ev-g-verlauf">{group.rows.map(row=>{
  const own=Boolean(result&&(result.areas.includes('mails')||row.channel!=='mail'&&row.createdBy===result.currentLogin&&result.areas.includes('eingang'))),options=concernOptions(row,result?.areas??[]),main=options.find(option=>option.reason===null&&row.openConcerns.includes(option.concern));
  const assignment=assignments[row.id]?.version===row.version?assignments[row.id].result:null,proposal=assignment?.code==='OK'&&assignment.view.proposals.length===1?assignment.view.proposals[0]:null;
  return <article key={row.id} data-spec-id="nachrichten.nachricht" className={'ev-g-zeile ev-g-zeile--'+(row.direction==='intern'?'notiz':row.direction==='raus'?'raus':'rein')} onContextMenu={event=>{if(own)showMenu(row,event);}} onPointerDown={event=>{if(!own||event.pointerType==='mouse')return;const x=event.clientX,y=event.clientY;longPress.current=setTimeout(()=>setMenu({id:row.id,x,y}),600);}} onPointerUp={()=>{if(longPress.current)clearTimeout(longPress.current);}} onPointerCancel={()=>{if(longPress.current)clearTimeout(longPress.current);}} onPointerMove={()=>{if(longPress.current)clearTimeout(longPress.current);}}>
   <div className={'ev-g-blase ev-g-blase--'+(row.direction==='intern'?'notiz':row.direction==='raus'?'raus':'rein')}><div className="ev-g-kopf"><b>{row.senderName??row.customerName??row.senderAddress??'Absender fehlt'}</b><small>{time(row.at)}{row.direction==='intern'?' · intern':''}</small></div>{row.subject?<b className="ev-g-betreff">{row.subject}</b>:null}<div className="ev-g-text">{row.text??'Inhalt fehlt'}</div>{row.fileIds.map(file=><button key={file} type="button" className="ev-g-anhang" data-spec-id="nachrichten.ansehen" onClick={()=>{if(open('original',row.id+'#'+file))setError('Original konnte nicht geöffnet werden · Code: INTAKE_ORIGINAL_TARGET_NOT_MOUNTED.');}}><Icon name="file"/>Ansehen</button>)}</div>
   {own&&row.assignment==='offen'&&row.direction==='rein'?<div className="ev-g-knoepfe">
    {!assignment?<p role="status">Zuordnung wird gelesen …</p>:assignment.code!=='OK'?<div role="alert"><Hinweis ton="warn">{assignment.message}</Hinweis><Button text="Erneut lesen" onClick={()=>void readAssignment(row)}/></div>:<>
     {proposal?<Button data-spec-id="nachrichten.vorschlag-ja" art="primaer" text={'Ja, zu '+proposal.name} disabled={busy} onClick={()=>void confirmAssignment(row,proposal.id)}/>:null}
     <Button data-spec-id="nachrichten.vorschlag-anders" art="leise" text="Anders zuordnen" disabled={busy} onClick={()=>differentAssignment(row)}/>
    </>}
   </div>:null}
   {own&&row.usage==='offen'?<div className="ev-g-anliegen"><div className="ev-g-a-kopf">{row.openConcerns.map(value=><span key={value} className="kr-chip">{value==='lesen'?'Lesen und zuordnen':options.find(option=>option.concern===value)?.text??value}</span>)}</div><div className="ev-g-knoepfe">{main?<Button art="primaer" text={main.text} disabled={busy} onClick={()=>void choose(row,main)}/>:<Button data-spec-id="nachrichten.entscheiden" art="primaer" text="Anliegen wählen" disabled={busy} onClick={event=>showMenu(row,event)}/>}<Button data-spec-id="nachrichten.anliegen-waehlen" art="leise" text="Anderes Anliegen" disabled={busy} onClick={event=>showMenu(row,event)}/><Button data-spec-id="nachrichten.nur-info" art="leise" text="Nur Info" disabled={busy} onClick={()=>void finish(row,'info')}/><Button data-spec-id="nachrichten.erledigt" art="leise" text="Erledigt" disabled={busy} onClick={()=>void finish(row,'erledigt')}/></div></div>:<div className="ev-g-erledigt">{row.usage==='offen'?'Offen':row.usage==='info'?'Als Info vermerkt':row.usage==='erledigt'?'Erledigt':row.usage}{own&&result?.areas.includes('mails')&&row.usage!=='offen'?<Button data-spec-id="nachrichten.wieder-oeffnen" art="leise" text="Wieder öffnen" onClick={()=>{setReopening(row);setReason('');setReopenInvalid(false);setError(null);}}/>:null}</div>}
  </article>;
 })}</div><div className="ev-g-knoepfe"><Button data-spec-id="nachrichten.aufgabe-anlegen" icon="check" text="Aufgabe" onClick={()=>{const row=group.rows.at(-1);if(row)taskFromConversation(row);}}/></div></div>;
 const visibleError=writeError??error;
 return <section data-spec-id="nachrichten" aria-busy={busy||loading} className="kr-stapel"><header className="kr-seitenkopf">{tab==='mail'?<h1>Nachrichten</h1>:null}{onClose?<Button icon="x" label="Schließen" onClick={onClose}/>:null}
  {tab==='mail'?<div data-spec-id="nachrichten.nfilter" className="ev-g-knoepfe" role="group" aria-label="Nachrichtenfilter">{MESSAGE_FILTERS.map(value=><Button key={value} data-spec-id={'nachrichten.nfilter.'+value} art={filter===value?'erledigen':'leise'} text={FILTER_LABELS[value]} aria-pressed={filter===value} onClick={()=>{setFilter(value);setSelected(null);}}/>)}</div>:null}
  {tab==='mail'?<div data-spec-id="nachrichten.filter" className="ev-g-knoepfe" role="group" aria-label="Anliegenfilter">{counts.filter(value=>value.count>0).map(value=><Button key={value.id} data-spec-id={'nachrichten.filter.'+value.id} aria-label={value.label} art={concernFilter===value.id?'erledigen':'leise'} text={value.label+' '+value.count} aria-pressed={concernFilter===value.id} onClick={()=>{setConcernFilter(current=>current===value.id?null:value.id);setSelected(null);}}/>)}</div>:null}</header>
  <div role="tablist" aria-label="Nachrichtenansicht" className={concernStyles.tabs}><button role="tab" aria-selected={tab==='mail'} onClick={()=>changeTab('mail')}>Mailansicht</button><button role="tab" aria-selected={tab==='concerns'} onClick={()=>changeTab('concerns')}>Anliegen</button></div>
  {tab==='concerns'&&result?<IntakeConcernsPanel messages={result.messages} canCreateQuote={result.areas.includes('geld')&&result.areas.includes('auftraege')} onMessage={row=>{setTab('mail');setSelected(messageGroupId(row));setFilter('alle');}} onQuote={id=>open('kv',id)} onPrepareQuote={row=>open('kv-vorbereiten','',{sourceItemId:row.id})}/>:null}
  {toast?<div role="status" className="kr-toast">{toast}</div>:null}{loading?<p role="status">Nachrichten werden geladen …</p>:null}
  {visibleError?<div role="status" aria-live="polite" data-spec-id="nachrichten.zustand.fehler"><Hinweis ton="warn">{visibleError}</Hinweis><Button data-spec-id="nachrichten.erneut" text={retry?'Erneut':'Erneut laden'} disabled={busy} onClick={()=>{setWriteError(null);if(retry)retry();else void load();}}/>{writeError?<Button text="Schließen" disabled={busy} onClick={()=>{setWriteError(null);setRetry(null);}}/>:null}</div>:null}
  {tab==='mail'&&!loading&&!visibleError&&!visible.length?<div data-spec-id="nachrichten.zustand.leer"><p>Alles erledigt · keine offenen Nachrichten</p><Button data-spec-id="nachrichten.alle-zeigen" text="Alle zeigen" onClick={()=>{setFilter('alle');setConcernFilter(null);}}/></div>:null}
  {tab==='mail'?<div className="ev-nachrichten"><div className="ev-nlinks ev-nliste">{visible.map(group=><button type="button" key={group.id} data-spec-id="nachrichten.gruppe" className={'ev-ngruppe ev-ngruppe--'+group.tone+(current?.id===group.id?' ev-ngruppe--an':'')} onClick={()=>setSelected(group.id)}><span className="kr-avatar">{group.name.trim().slice(0,2).toUpperCase()}</span><span className="ev-ngruppe-t"><b>{group.name}</b><span className="ev-ngruppe-l">{group.rows.at(-1)?.subject??group.rows.at(-1)?.text??'Inhalt fehlt'}</span></span><span className="ev-ngruppe-r">{time(group.rows.at(-1)!.at)}<i className="ev-ngruppe-n">{group.open}</i></span></button>)}</div>{current&&(device!=='handy'||selected!==null)?<div className="ev-nrechts">{renderRows(current)}</div>:null}</div>:null}
  {menu&&menuMessage&&result?createPortal(<KrApp geraet={device} portal><ConcernMenu message={menuMessage} areas={result.areas} anchor={menu} busy={busy} error={visibleError} onSelect={option=>void choose(menuMessage,option)} onInfo={()=>void finish(menuMessage,'info')} onNoBusiness={()=>noBusiness(menuMessage)} onClose={()=>{setMenu(null);setError(null);setWriteError(null);setRetry(null);}}/></KrApp>,document.body):null}
  {reopening?<Dialog titel="Wieder öffnen" onSchliessen={()=>{if(!busy){setReopening(null);setWriteError(null);setRetry(null);}}} meldung={visibleError?{ton:'fehler',text:visibleError}:null} fuss={<><Button text="Zurück" disabled={busy} onClick={()=>{setReopening(null);setWriteError(null);setRetry(null);}}/><Button data-spec-id="nachrichten.wieder-speichern" art="primaer" text={busy?'Wird gespeichert …':'Wieder öffnen'} disabled={busy} onClick={()=>{setWriteError(null);void reopen();}}/></>}><div data-spec-id="nachrichten.zustand.wieder"><label>Grund<input className="kr-input" data-spec-id="nachrichten.grund" aria-invalid={reopenInvalid} aria-describedby={reopenInvalid?'nachrichten.grund.fehler':undefined} minLength={3} maxLength={200} value={reason} onChange={event=>{setReason(event.target.value);setReopenInvalid(false);setError(null);}}/></label>{reopenInvalid?<span id="nachrichten.grund.fehler" data-spec-id="nachrichten.grund.fehler" role="alert">{visibleError}</span>:null}</div></Dialog>:null}
 </section>;
}
