'use client';
import {ComplaintResponseDialog} from './ComplaintResponseDialog';
import type {IntakeDraft} from '../draftContract';
import type {ComplaintResponseRequest} from '../messageContract';
import {ORDER_HANDOVER_COPY,REKLA_MAIL_COPY,MAIL_DELIVERY_COPY,PHOTOLESS_CLOSE_COPY,complaintFailureCopy} from '@/ui/situationCatalog';
import {useCallback,useEffect,useEffectEvent,useMemo,useRef,useState,type MouseEvent,type ReactNode} from 'react';
import {ACTOR_COPY} from '@/ui/situationCatalog';
import {createPortal} from 'react-dom';
import {Button,Dialog,Hinweis,Icon,KrApp,useKrGeraet,Feld,Textfeld} from '@/ui/kr';
import {MESSAGE_FILTERS,INTAKE_CHANGED_EVENT,messageGroupId,messageTone,type MessageFilter,type IntakeMessage,type IntakeMessagesPorts,type IntakeMessagesResult,type IntakeHandoverRequest} from '../messageContract';
import {concernOptions,type ConcernOption} from '../concernMenuContract';
import {intakeRequiredEffect,INTAKE_CONCERN_AREAS} from '../intakeLifecycleContract';
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
export function IntakeMessages({ports,initialGroup,onClose,resumeDraftId}:{ports:IntakeMessagesPorts;initialGroup?:string;onClose?:()=>void;resumeDraftId?:string}){
 const [response,setResponse]=useState<{row:IntakeMessage;restored?:{draft:IntakeDraft;request:ComplaintResponseRequest;attempted:boolean}}|null>(null);const resumed=useRef(false);
 const[handoverChoice,setHandoverChoice]=useState<{request:IntakeHandoverRequest;choices:Array<{id:string;number:string|null;version:number}>}|null>(null);
 const [tab,setTab]=useState<'mail'|'concerns'>('mail');
 const changeTab=(next:'mail'|'concerns')=>setTab(next);
 const [filter,setFilter]=useState<MessageFilter>(initialGroup?'alle':'offen'),[concernFilter,setConcernFilter]=useState<string|null>(null),[result,setResult]=useState<Extract<IntakeMessagesResult,{code:'OK'}>|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null),[selected,setSelected]=useState<string|null>(initialGroup??null),[menu,setMenu]=useState<{id:string;x:number;y:number}|null>(null),[busy,setBusy]=useState(false),[toast,setToast]=useState<string|null>(null),[retry,setRetry]=useState<(()=>void)|null>(null),[reopening,setReopening]=useState<IntakeMessage|null>(null),[reason,setReason]=useState('');
 const effectiveFilter:MessageFilter=tab==='concerns'?'alle':filter;
 const device=useKrGeraet(),inFlight=useRef(false),keys=useRef(new Map<string,string>()),longPress=useRef<ReturnType<typeof setTimeout>|null>(null),requestId=useRef(0);
 const[assignments,setAssignments]=useState<Record<string,{version:number;result:AssignmentReadResult}>>({}),assignmentRequests=useRef(new Set<string>());
 const[reopenInvalid,setReopenInvalid]=useState(false),[writeError,setWriteError]=useState<string|null>(null);
 const key=(operation:string,row:IntakeMessage)=>{const id=operation+':'+row.id+':'+row.version;if(!keys.current.has(id))keys.current.set(id,crypto.randomUUID());return keys.current.get(id)!;};
 const [photoChecks,setPhotoChecks]=useState<Record<string,{row:IntakeMessage;at:string}>>({});
 const [photoClose,setPhotoClose]=useState<{row:IntakeMessage;reason:string;key:string;error:string|null}|null>(null);
 const [photoFailed,setPhotoFailed]=useState<Record<string,boolean>>({});
 const restorePhotoDelivery=useCallback((messages:IntakeMessage[])=>{
  for(const row of messages){
   const state=row.photoDelivery;if(!state||row.photoRequest||state.state==='source-changed')continue;
   if(state.state==='failed'){setPhotoFailed(current=>({...current,[row.id]:true}));keys.current.delete('complaint-photos:'+row.id+':'+row.version);setPhotoChecks(current=>{const next={...current};delete next[row.id];return next;});continue;}
   if(!state.clientRequestId)continue;
   const original={...row,version:state.version,customerId:state.deliveryCustomerId??row.customerId};
   keys.current.set('complaint-photos:'+row.id+':'+state.version,state.clientRequestId);
   setPhotoChecks(current=>({...current,[row.id]:{row:original,at:state.retryAt}}));
  }
 },[]);
 const load=useCallback(async(signal?:AbortSignal)=>{const request=++requestId.current;setLoading(true);setError(null);try{const read=await ports.list(effectiveFilter);if(request!==requestId.current||signal?.aborted)return;if(read.code!=='OK'){setError(read.message);return;}restorePhotoDelivery(read.messages);setResult(read);return read;}catch(failure){console.error('[INTAKE_MESSAGES_UI_READ_FAILED]',failure);if(request===requestId.current&&!signal?.aborted)setError('Nachrichten konnten nicht geladen werden · Code: INTAKE_MESSAGES_UI_READ_FAILED.');}finally{if(request===requestId.current&&!signal?.aborted)setLoading(false);}},[ports,effectiveFilter,restorePhotoDelivery]);
 useEffect(()=>{const controller=new AbortController(),timer=setTimeout(()=>void load(controller.signal),0);return()=>{clearTimeout(timer);controller.abort();};},[load]);
 useEffect(()=>{const changed=()=>void load();window.addEventListener(INTAKE_CHANGED_EVENT,changed);return()=>window.removeEventListener(INTAKE_CHANGED_EVENT,changed);},[load]);
 useEffect(()=>{return()=>{if(longPress.current)clearTimeout(longPress.current);};},[]);
 useEffect(()=>{if(!resumeDraftId||!result||!ports.replyDrafts||resumed.current)return;resumed.current=true;void ports.replyDrafts.readDrafts().then(read=>{if(read.code!=='OK')throw Error(read.message);const draft=read.drafts.find(value=>value.id===resumeDraftId),payload=draft?.payload,request=payload?.request as ComplaintResponseRequest|undefined;const row=result.messages.find(value=>value.id===payload?.sourceItemId);if(!draft||payload?.kind!=='rekla-response'||!request||request.complaintRejection?.itemId!==row?.id||request.targetId!==row?.customerId||typeof request.subject!=='string'||typeof request.body!=='string'||typeof request.complaintRejection.reason!=='string')throw Error(REKLA_MAIL_COPY.responseUnavailable);setResponse({row,restored:{draft,request,attempted:payload.attempted===true}});}).catch(failure=>{console.error('[COMPLAINT_RESPONSE_RESTORE_FAILED]',failure);setWriteError(REKLA_MAIL_COPY.responseUnavailable);});},[resumeDraftId,result,ports]);
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
 const requestPhotos=async(row:IntakeMessage)=>{
  if(inFlight.current||!row.customerId||!ports.requestPhotos)return;inFlight.current=true;setBusy(true);setWriteError(null);setRetry(null);
  try{const sent=await ports.requestPhotos({targetType:'CUSTOMER',targetId:row.customerId,clientRequestId:key('complaint-photos',row),subject:'',body:'',complaintPhotoRequest:{itemId:row.id,version:row.version}});
   if(sent.code!=='OK'){
    if('delivery'in sent&&sent.delivery==='checking'){
     if('retryAt'in sent&&typeof sent.retryAt==='string'&&Number.isFinite(Date.parse(sent.retryAt))){const at=sent.retryAt;setPhotoChecks(current=>({...current,[row.id]:{row,at}}));}
     setWriteError(MAIL_DELIVERY_COPY.checking);return;
    }
    setPhotoChecks(current=>{const next={...current};delete next[row.id];return next;});
    if('delivery'in sent&&sent.delivery==='failed'){keys.current.delete('complaint-photos:'+row.id+':'+row.version);setPhotoFailed(current=>({...current,[row.id]:true}));const customer=row.customerName??row.senderName??row.senderAddress;fail(customer?MAIL_DELIVERY_COPY.failed(customer):REKLA_MAIL_COPY.unavailable,()=>void requestPhotos(row));return;}
    fail(REKLA_MAIL_COPY.unavailable,()=>void requestPhotos(row));return;
   }
   setPhotoChecks(current=>{const next={...current};delete next[row.id];return next;});
   if('data'in sent&&sent.data&&typeof sent.data==='object'&&'sourceChanged'in sent.data&&sent.data.sourceChanged===true){setRetry(null);const updated=await load();if(!updated?.messages.some(message=>message.id===row.id&&message.photoDelivery?.state==='source-changed'))setWriteError(MAIL_DELIVERY_COPY.sourceChanged('deliveryCustomer'in sent.data&&typeof sent.data.deliveryCustomer==='string'?sent.data.deliveryCustomer:row.customerName??row.senderName??row.senderAddress??''));return;}
   setToast(REKLA_MAIL_COPY.sent);await load();
  }catch(failure){console.error('[COMPLAINT_PHOTO_REQUEST_UI_FAILED]',failure);fail(REKLA_MAIL_COPY.unavailable,()=>void requestPhotos(row));}
  finally{inFlight.current=false;setBusy(false);}
 };
 const closePhotoless=async()=>{
  if(!photoClose||inFlight.current)return;if(photoClose.reason.trim().length<3){setPhotoClose({...photoClose,error:PHOTOLESS_CLOSE_COPY.missing});return;}
  inFlight.current=true;setBusy(true);try{const changed=await ports.finish({items:[{itemId:photoClose.row.id,version:photoClose.row.version}],clientEventId:photoClose.key,kind:'reklamation_ohne_fotos',note:photoClose.reason.trim()});if(changed.code!=='OK'){setPhotoClose(current=>current?{...current,error:complaintFailureCopy(changed.code)}:null);return;}setPhotoClose(null);await load();setToast(PHOTOLESS_CLOSE_COPY.done);}catch(error){console.error('[PHOTOLESS_CLOSE_FAILED]',{name:error instanceof Error?error.name:'UnknownError'});setPhotoClose(current=>current?{...current,error:complaintFailureCopy('UNAVAILABLE')}:null);}finally{inFlight.current=false;setBusy(false);}
 };
 const reloadPhotoless=async()=>{if(!photoClose||inFlight.current)return;inFlight.current=true;setBusy(true);try{const refreshed=await load(),current=refreshed?.messages.find(row=>row.id===photoClose.row.id);if(current?.usage==='offen'&&current.openConcerns.includes('reklamation'))setPhotoClose({...photoClose,row:current,key:crypto.randomUUID(),error:null});else if(refreshed){setPhotoClose(null);setToast(PHOTOLESS_CLOSE_COPY.reloaded);}else setPhotoClose(state=>state?{...state,error:complaintFailureCopy('UNAVAILABLE')}:null);}finally{inFlight.current=false;setBusy(false);}};
 const checkPhotoDelivery=useEffectEvent(async(now:number)=>{
  for(const pending of Object.values(photoChecks)){
   if(Date.parse(pending.at)>now)continue;
   if(inFlight.current){setPhotoChecks(current=>({...current,[pending.row.id]:{...pending,at:new Date(now+1000).toISOString()}}));continue;}
   await requestPhotos(pending.row);
  }
 });
 useEffect(()=>{
  const times=Object.values(photoChecks).map(value=>Date.parse(value.at));if(!times.length)return;
  const timer=setTimeout(()=>void checkPhotoDelivery(Date.now()),Math.max(0,Math.min(...times)-Date.now()));return()=>clearTimeout(timer);
 },[photoChecks]);
 const finish=async(row:IntakeMessage,kind:'info'|'erledigt')=>{
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError(null);setWriteError(null);setRetry(null);
  try{const saved=await ports.finish({items:[{itemId:row.id,version:row.version}],kind,note:null,clientEventId:key(kind,row)});if(saved.code!=='OK'){fail(saved.message,()=>void finish(row,kind));return;}setMenu(null);setToast(kind==='info'?'Als Info vermerkt':'Erledigt');await load();}
  catch(failure){console.error('[INTAKE_MESSAGES_FINISH_FAILED]',failure);fail('Code: INTAKE_MESSAGES_FINISH_FAILED.',()=>void finish(row,kind));}finally{inFlight.current=false;setBusy(false);}
 };
 const handover=async(request:IntakeHandoverRequest)=>{
  if(!ports.handover){fail(ORDER_HANDOVER_COPY.targetUnavailable);return;}
  let saved;try{saved=await ports.handover(request);}catch(failure){console.error('[MAIL_HANDOVER_UI_FAILED]',failure);fail(ORDER_HANDOVER_COPY.targetUnavailable,()=>void runHandover(request));return;}
  if(saved.code!=='OK'){
   if('choices'in saved&&saved.choices?.length){setHandoverChoice({request,choices:saved.choices});setMenu(null);}
   fail('message'in saved?saved.message:ORDER_HANDOVER_COPY.targetUnavailable,()=>void runHandover(request));return;
  }
  setHandoverChoice(null);setMenu(null);setWriteError(null);setRetry(null);await load();
  const receipt=saved.receipt as {orderId?:string;message?:string};setToast(receipt.message??null);
  if(receipt.orderId&&open('auftrag',receipt.orderId))fail(ORDER_HANDOVER_COPY.targetUnavailable);
 };
 const runHandover=async(request:IntakeHandoverRequest)=>{if(inFlight.current)return;inFlight.current=true;setBusy(true);try{await handover(request);}catch(failure){console.error('[MAIL_HANDOVER_UI_FAILED]',failure);fail(ORDER_HANDOVER_COPY.targetUnavailable,()=>void runHandover(request));}finally{inFlight.current=false;setBusy(false);}};
 const choose=async(row:IntakeMessage,option:ConcernOption)=>{
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError(null);setWriteError(null);setRetry(null);
  try{const saved=await ports.select({itemId:row.id,version:row.version,concern:option.concern,clientEventId:key('select:'+option.concern,row)});if(saved.code!=='OK'){fail(saved.message,()=>void choose(row,option));return;}
   if(option.concern==='abholung'&&row.channel==='mail'){
    await handover({command:'handover_from_mail',sourceItemId:row.id,sourceVersion:saved.capture.version,clientEventId:key('handover',row)});return;
   }
   await load();
   if(option.target==='aufgabe'){
    const request={reference:{type:'eingang',id:row.id},kind:option.concern,itemId:row.id};
    if(open('aufgabe',row.id+'#'+option.concern,{taskRequest:request})){fail('Aufgabe konnte nicht geöffnet werden · Anliegen bleibt offen. Code: TASK_TARGET_NOT_MOUNTED.');return;}
   }else if(row.orderKind==='kv'&&row.orderId&&['kv_annahme','kv_ablehnung'].includes(option.concern)){
    if(open('kv',row.orderId+'#'+row.id)){fail('KV konnte nicht geöffnet werden · Anliegen bleibt offen.');return;}
   }else if(option.concern==='kv_anfrage'){
    if(open('kv-vorbereiten','',{sourceItemId:row.id})){fail('KV-Vorbereitung konnte nicht geöffnet werden · Anliegen bleibt offen.');return;}
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
  const photoReplies=row.photoReplies??[];
  const needsPhotos=row.channel==='mail'&&row.direction==='rein'&&row.customerId!==null&&row.usage==='offen'&&row.openConcerns.includes('reklamation')&&row.photoCount===0;
  const assignment=assignments[row.id]?.version===row.version?assignments[row.id].result:null,proposal=assignment?.code==='OK'&&assignment.view.proposals.length===1?assignment.view.proposals[0]:null;
  return <article key={row.id} data-spec-id="nachrichten.nachricht" className={'ev-g-zeile ev-g-zeile--'+(row.direction==='intern'?'notiz':row.direction==='raus'?'raus':'rein')} onContextMenu={event=>{if(own)showMenu(row,event);}} onPointerDown={event=>{if(!own||event.pointerType==='mouse')return;const x=event.clientX,y=event.clientY;longPress.current=setTimeout(()=>setMenu({id:row.id,x,y}),600);}} onPointerUp={()=>{if(longPress.current)clearTimeout(longPress.current);}} onPointerCancel={()=>{if(longPress.current)clearTimeout(longPress.current);}} onPointerMove={()=>{if(longPress.current)clearTimeout(longPress.current);}}>
   <div className={'ev-g-blase ev-g-blase--'+(row.direction==='intern'?'notiz':row.direction==='raus'?'raus':'rein')}><div className="ev-g-kopf"><b>{row.senderName??row.customerName??row.senderAddress??'Absender fehlt'}</b><small>{time(row.at)}{row.direction==='intern'?' · intern':''}</small></div>{row.actorTrace?.lastActor?<small data-spec-id="nachrichten.akteur">{ACTOR_COPY.last(row.actorTrace.lastActor.name??ACTOR_COPY.unknownLogin,ACTOR_COPY.action(row.actorTrace.lastActor.action))}</small>:null}{row.subject?<b className="ev-g-betreff">{row.subject}</b>:null}<div className="ev-g-text">{row.text??'Inhalt fehlt'}</div>{row.fileIds.map(file=><button key={file} type="button" className="ev-g-anhang" data-spec-id="nachrichten.ansehen" onClick={()=>{if(open('original',row.id+'#'+file))setError('Original konnte nicht geöffnet werden · Code: INTAKE_ORIGINAL_TARGET_NOT_MOUNTED.');}}><Icon name="file"/>Ansehen</button>)}</div>
   {photoReplies.length?<div className="ev-g-knoepfe">{photoReplies.map(reply=><div key={reply.replyId}><p>{REKLA_MAIL_COPY.received(reply.photoIds.length)}</p>{result?.areas.includes('auftraege')?<Button art="primaer" text={REKLA_MAIL_COPY.record} onClick={()=>{const target=reply.orderId?reply.orderId+'#'+reply.replyId:row.customerId+'#kundenwahl';if(open('reklamation',target,{sourceItemId:reply.replyId}))fail(ORDER_HANDOVER_COPY.targetUnavailable);}}/>:null}{ports.ReplyMailView&&ports.rejectComplaint&&result?.areas.includes('eingang')&&result.areas.includes('kunden')?<Button text={REKLA_MAIL_COPY.reject} onClick={()=>{const source=result.messages.find(value=>value.id===reply.replyId);if(source)setResponse({row:source});else fail(REKLA_MAIL_COPY.responseUnavailable);}}/>:null}<Button text={REKLA_MAIL_COPY.original} onClick={()=>{if(open('original',reply.replyId+'#'+reply.photoIds[0]))fail(ORDER_HANDOVER_COPY.targetUnavailable);}}/></div>)}</div>:row.photoParentId?<p>{REKLA_MAIL_COPY.parent}</p>:null}
   {own&&row.usage==='offen'&&row.openConcerns.includes('reklamation')&&row.channel==='mail'&&(row.photoCount??0)>0&&!row.photoParentId&&ports.ReplyMailView&&ports.rejectComplaint&&result?.areas.includes('eingang')&&result.areas.includes('kunden')?<Button text={REKLA_MAIL_COPY.reject} onClick={()=>setResponse({row})}/>:null}
   {needsPhotos&&!photoReplies.length?<div className="ev-g-knoepfe">{row.photoDelivery?.state==='source-changed'?<><p role="status">{MAIL_DELIVERY_COPY.sourceChanged(row.photoDelivery.deliveryCustomer??row.customerName??row.senderName??row.senderAddress??'')}</p><Button text={MAIL_DELIVERY_COPY.reload} onClick={()=>void load()}/></>:row.photoRequest?<p role="status">{REKLA_MAIL_COPY.waiting(row.customerName??row.senderName??row.senderAddress??'Kunde')}</p>:photoChecks[row.id]||!photoFailed[row.id]&&row.photoDelivery?.state==='checking'?<p role="status">{MAIL_DELIVERY_COPY.checking}</p>:ports.requestPhotos&&result?.areas.includes('eingang')&&result.areas.includes('kunden')?<><p>{REKLA_MAIL_COPY.missing}</p><Button art="primaer" text={photoFailed[row.id]?MAIL_DELIVERY_COPY.retry:REKLA_MAIL_COPY.request} disabled={busy} onClick={()=>void requestPhotos(row)}/></>:null}</div>:null}
   {needsPhotos&&!photoReplies.length&&result&&INTAKE_CONCERN_AREAS.reklamation.every(area=>result.areas.includes(area))?<Button text={PHOTOLESS_CLOSE_COPY.open} disabled={busy} onClick={()=>setPhotoClose({row,reason:'',key:crypto.randomUUID(),error:null})}/>:null}
   {own&&row.assignment==='offen'&&row.direction==='rein'?<div className="ev-g-knoepfe">
    {!assignment?<p role="status">Zuordnung wird gelesen …</p>:assignment.code!=='OK'?<div role="alert"><Hinweis ton="warn">{assignment.message}</Hinweis><Button text="Erneut lesen" onClick={()=>void readAssignment(row)}/></div>:<>
     {proposal?<Button data-spec-id="nachrichten.vorschlag-ja" art="primaer" text={'Ja, zu '+proposal.name} disabled={busy} onClick={()=>void confirmAssignment(row,proposal.id)}/>:null}
     <Button data-spec-id="nachrichten.vorschlag-anders" art="leise" text="Anders zuordnen" disabled={busy} onClick={()=>differentAssignment(row)}/>
    </>}
   </div>:null}
   {own&&row.usage==='offen'?<div className="ev-g-anliegen"><div className="ev-g-a-kopf">{row.openConcerns.map(value=><span key={value} className="kr-chip">{value==='lesen'?'Lesen und zuordnen':options.find(option=>option.concern===value)?.text??value}</span>)}</div><div className="ev-g-knoepfe">{needsPhotos||photoReplies.length||row.photoParentId?null:main?<Button art="primaer" text={main.text} disabled={busy} onClick={()=>void choose(row,main)}/>:<Button data-spec-id="nachrichten.entscheiden" art="primaer" text={intakeRequiredEffect(row.openConcerns)??"Anliegen wählen"} disabled={busy} onClick={event=>showMenu(row,event)}/>}<Button data-spec-id="nachrichten.anliegen-waehlen" art="leise" text="Anderes Anliegen" disabled={busy} onClick={event=>showMenu(row,event)}/>{!intakeRequiredEffect(row.openConcerns)?<><Button data-spec-id="nachrichten.nur-info" art="leise" text="Nur Info" disabled={busy} onClick={()=>void finish(row,'info')}/><Button data-spec-id="nachrichten.erledigt" art="leise" text="Erledigt" disabled={busy} onClick={()=>void finish(row,'erledigt')}/></>:null}</div></div>:<div className="ev-g-erledigt">{row.usage==='offen'?'Offen':row.usage==='info'?'Als Info vermerkt':row.usage==='erledigt'?'Erledigt':row.usage}{own&&result?.areas.includes('mails')&&row.usage!=='offen'?<Button data-spec-id="nachrichten.wieder-oeffnen" art="leise" text="Wieder öffnen" onClick={()=>{setReopening(row);setReason('');setReopenInvalid(false);setError(null);}}/>:null}</div>}
  </article>;
 })}</div><div className="ev-g-knoepfe"><Button data-spec-id="nachrichten.aufgabe-anlegen" icon="check" text="Aufgabe" onClick={()=>{const row=group.rows.at(-1);if(row)taskFromConversation(row);}}/></div></div>;
 const visibleError=writeError??error;
 return <section data-spec-id="nachrichten" aria-busy={busy||loading} className="kr-stapel"><header className="kr-seitenkopf">{tab==='mail'?<h1>Nachrichten</h1>:null}{onClose?<Button icon="x" label="Schließen" onClick={onClose}/>:null}
  {tab==='mail'?<div data-spec-id="nachrichten.nfilter" className="ev-g-knoepfe" role="group" aria-label="Nachrichtenfilter">{MESSAGE_FILTERS.map(value=><Button key={value} data-spec-id={'nachrichten.nfilter.'+value} art={filter===value?'erledigen':'leise'} text={FILTER_LABELS[value]} aria-pressed={filter===value} onClick={()=>{setFilter(value);setSelected(null);}}/>)}</div>:null}
  {tab==='mail'?<div data-spec-id="nachrichten.filter" className="ev-g-knoepfe" role="group" aria-label="Anliegenfilter">{counts.filter(value=>value.count>0).map(value=><Button key={value.id} data-spec-id={'nachrichten.filter.'+value.id} aria-label={value.label} art={concernFilter===value.id?'erledigen':'leise'} text={value.label+' '+value.count} aria-pressed={concernFilter===value.id} onClick={()=>{setConcernFilter(current=>current===value.id?null:value.id);setSelected(null);}}/>)}</div>:null}</header>
  <div role="tablist" aria-label="Nachrichtenansicht" className={concernStyles.tabs}><button role="tab" aria-selected={tab==='mail'} onClick={()=>changeTab('mail')}>Mailansicht</button><button role="tab" aria-selected={tab==='concerns'} onClick={()=>changeTab('concerns')}>Anliegen</button></div>
  {tab==='concerns'&&result?<IntakeConcernsPanel messages={result.messages} canCreateQuote={result.areas.includes('geld')&&result.areas.includes('auftraege')} onMessage={row=>{setTab('mail');setSelected(messageGroupId(row));setFilter('alle');}} onQuote={id=>open('kv',id)} onPrepareQuote={row=>open('kv-vorbereiten','',{sourceItemId:row.id})}/>:null}
  {toast?<div role="status" className="kr-toast">{toast}</div>:null}{loading?<p role="status">Nachrichten werden geladen …</p>:null}
  {visibleError?<div role="status" aria-live="polite" data-spec-id="nachrichten.zustand.fehler"><Hinweis ton="warn">{visibleError}</Hinweis><Button data-spec-id="nachrichten.erneut" text={retry?'Erneut':MAIL_DELIVERY_COPY.reload} disabled={busy} onClick={()=>{setWriteError(null);if(retry)retry();else void load();}}/>{writeError?<Button text="Schließen" disabled={busy} onClick={()=>{setWriteError(null);setRetry(null);}}/>:null}</div>:null}
  {tab==='mail'&&!loading&&!visibleError&&!visible.length?<div data-spec-id="nachrichten.zustand.leer"><p>Alles erledigt · keine offenen Nachrichten</p><Button data-spec-id="nachrichten.alle-zeigen" text="Alle zeigen" onClick={()=>{setFilter('alle');setConcernFilter(null);}}/></div>:null}
  {tab==='mail'?<div className="ev-nachrichten"><div className="ev-nlinks ev-nliste">{visible.map(group=><button type="button" key={group.id} data-spec-id="nachrichten.gruppe" className={'ev-ngruppe ev-ngruppe--'+group.tone+(current?.id===group.id?' ev-ngruppe--an':'')} onClick={()=>setSelected(group.id)}><span className="kr-avatar">{group.name.trim().slice(0,2).toUpperCase()}</span><span className="ev-ngruppe-t"><b>{group.name}</b><span className="ev-ngruppe-l">{group.rows.at(-1)?.subject??group.rows.at(-1)?.text??'Inhalt fehlt'}</span></span><span className="ev-ngruppe-r">{time(group.rows.at(-1)!.at)}<i className="ev-ngruppe-n">{group.open}</i></span></button>)}</div>{current&&(device!=='handy'||selected!==null)?<div className="ev-nrechts">{renderRows(current)}</div>:null}</div>:null}
  {menu&&menuMessage&&result?createPortal(<KrApp geraet={device} portal><ConcernMenu message={menuMessage} areas={result.areas} anchor={menu} busy={busy} error={visibleError} onSelect={option=>void choose(menuMessage,option)} onInfo={()=>void finish(menuMessage,'info')} onNoBusiness={()=>noBusiness(menuMessage)} onClose={()=>{setMenu(null);setError(null);setWriteError(null);setRetry(null);}}/></KrApp>,document.body):null}
  {handoverChoice?<Dialog titel={ORDER_HANDOVER_COPY.chooseOrder} onSchliessen={()=>{if(!busy)setHandoverChoice(null);}} meldung={visibleError?{ton:'fehler',text:visibleError}:null}>{handoverChoice.choices.map(choice=><Button key={choice.id} text={ORDER_HANDOVER_COPY.choose(choice.number??choice.id)} disabled={busy} onClick={()=>void runHandover({...handoverChoice.request,orderId:choice.id,expectedVersion:choice.version})}/>)}</Dialog>:null}
  {reopening?<Dialog titel="Wieder öffnen" onSchliessen={()=>{if(!busy){setReopening(null);setWriteError(null);setRetry(null);}}} meldung={visibleError?{ton:'fehler',text:visibleError}:null} fuss={<><Button text="Zurück" disabled={busy} onClick={()=>{setReopening(null);setWriteError(null);setRetry(null);}}/><Button data-spec-id="nachrichten.wieder-speichern" art="primaer" text={busy?'Wird gespeichert …':'Wieder öffnen'} disabled={busy} onClick={()=>{setWriteError(null);void reopen();}}/></>}><div data-spec-id="nachrichten.zustand.wieder"><label>Grund<input className="kr-input" data-spec-id="nachrichten.grund" aria-invalid={reopenInvalid} aria-describedby={reopenInvalid?'nachrichten.grund.fehler':undefined} minLength={3} maxLength={200} value={reason} onChange={event=>{setReason(event.target.value);setReopenInvalid(false);setError(null);}}/></label>{reopenInvalid?<span id="nachrichten.grund.fehler" data-spec-id="nachrichten.grund.fehler" role="alert">{visibleError}</span>:null}</div></Dialog>:null}
  {photoClose?<Dialog titel={PHOTOLESS_CLOSE_COPY.open} onSchliessen={()=>{if(!busy)setPhotoClose(null);}} meldung={photoClose.error?{ton:'fehler',text:photoClose.error}:null} fuss={<><Button text={PHOTOLESS_CLOSE_COPY.cancel} disabled={busy} onClick={()=>setPhotoClose(null)}/>{photoClose.error?<Button text={PHOTOLESS_CLOSE_COPY.reload} disabled={busy} onClick={()=>void reloadPhotoless()}/>:null}<Button text={busy?PHOTOLESS_CLOSE_COPY.pending:PHOTOLESS_CLOSE_COPY.save} disabled={busy} onClick={()=>void closePhotoless()}/></>}><Feld label={PHOTOLESS_CLOSE_COPY.reason}><Textfeld value={photoClose.reason} maxLength={2000} disabled={busy} onChange={e=>setPhotoClose({...photoClose,reason:e.target.value,error:null})}/></Feld></Dialog>:null}
  {response?<ComplaintResponseDialog key={response.row.id} row={response.row} ports={ports} restored={response.restored} onClose={message=>{setResponse(null);if(message)setToast(message);}} onSent={()=>{setResponse(null);setToast(REKLA_MAIL_COPY.responseSent);void load();}}/>:null}
 </section>;
}
