'use client';
import {useRef,useState} from 'react';
import {Button,Dialog} from '@/ui/kr';
import {REKLA_MAIL_COPY as C} from '@/ui/situationCatalog';
import type {ComplaintResponseRequest,IntakeMessage,IntakeMessagesPorts} from '../messageContract';
import type {IntakeDraft} from '../draftContract';

type Stored={draft:IntakeDraft;request:ComplaintResponseRequest;attempted:boolean};
export function ComplaintResponseDialog({row,ports,restored,onClose,onSent}:{row:IntakeMessage;ports:IntakeMessagesPorts;restored?:Stored;onClose:(message:string)=>void;onSent:()=>void}){
 const[subject,setSubject]=useState(restored?.request.subject??C.responseSubject(row.subject??'')),[body,setBody]=useState(restored?.request.body??''),[reason,setReason]=useState(restored?.request.complaintRejection.reason??''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[stored,setStored]=useState<Stored|undefined>(restored);
 const [locked,setLocked]=useState(restored?.attempted??false);
 const pending=useRef<ComplaintResponseRequest|undefined>(restored?.attempted?restored.request:undefined),working=useRef(false),draftKey=useRef(restored?.draft.id??crypto.randomUUID()),clientKey=useRef(restored?.request.clientRequestId??crypto.randomUUID()),draftOp=useRef<string|null>(null);
 const request=():ComplaintResponseRequest=>pending.current??{targetType:'CUSTOMER',targetId:row.customerId!,clientRequestId:clientKey.current,subject,body,complaintRejection:{itemId:row.id,version:row.version,reason}};
 const save=async(attempted:boolean)=>{
  if(!ports.replyDrafts)throw Error(C.responseUnavailable);
  const input=request();const result=await ports.replyDrafts.saveDraft({id:draftKey.current,clientEventId:draftOp.current??=crypto.randomUUID(),art:'eingang',expectedVersion:stored?.draft.version??null,lastField:null,payload:{kind:'rekla-response',version:1,clientKey:input.clientRequestId,customerName:row.customerName??row.senderName??row.senderAddress??'',sourceItemId:row.id,request:input,attempted}});
  if(result.code!=='OK')throw Error(result.message);const draft=result.drafts.find(value=>value.id===draftKey.current);if(!draft)throw Error(C.responseUnavailable);const next={draft,request:input,attempted};setStored(next);draftOp.current=null;window.dispatchEvent(new Event('kreile:intake-drafts-changed'));return next;
 };
 const close=async()=>{if(working.current)return;working.current=true;setBusy(true);try{if(!subject.trim()&&!body.trim()&&!reason.trim()&&!stored){onClose('');return;}await save(locked);onClose(C.responseSaved);}catch(failure){console.error('[COMPLAINT_RESPONSE_DRAFT_FAILED]',failure);setError(failure instanceof Error?failure.message:C.responseUnavailable);}finally{working.current=false;setBusy(false);}};
 const send=async()=>{
  if(working.current||!ports.rejectComplaint||!row.customerId)return;
  const input=request();if(!input.subject.trim()||!input.body.trim()||input.complaintRejection.reason.trim().length<3){setError(C.responseInvalid);return;}
  working.current=true;setBusy(true);setError(null);
  try{
   const saved=await save(true);pending.current=input;setLocked(true);
   const result=await ports.rejectComplaint(input);if(result.code!=='OK'){setError('message' in result?result.message:C.responseUnavailable);return;}
   if(ports.replyDrafts){const cleared=await ports.replyDrafts.discardDraft({id:saved.draft.id,clientEventId:crypto.randomUUID(),expectedVersion:saved.draft.version});if(cleared.code!=='OK'){setError(C.responseSent+' '+cleared.message);return;}window.dispatchEvent(new Event('kreile:intake-drafts-changed'));}
   onSent();
  }catch(failure){console.error('[COMPLAINT_RESPONSE_UI_FAILED]',failure);setError(C.responseUnavailable);}finally{working.current=false;setBusy(false);}
 };
 const MailView=ports.ReplyMailView;
 return <Dialog titel={C.responseTitle} onSchliessen={()=>void close()} vorSchliessen={()=>!working.current} meldung={error?{ton:'fehler',text:error}:null} fuss={<><Button text={C.responseBack} disabled={busy} onClick={()=>void close()}/><Button art="primaer" text={busy?C.responseSaving:locked?C.responseRetry:C.responseSend} disabled={busy} onClick={()=>void send()}/></>}>
 <label>{C.responseReason}<textarea className="kr-input" minLength={3} maxLength={500} value={reason} disabled={busy||locked} onChange={event=>setReason(event.target.value)}/></label>
 {MailView&&row.customerId?<MailView customerId={row.customerId} composer={{subject,body,onSubject:setSubject,onBody:setBody,onSend:()=>void send(),busy:busy||locked}}/>:null}
 </Dialog>;
}
