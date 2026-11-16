import {readServerReachability,subscribeServerReachability} from '@/lib/offline/serverReachability';
import {CLICK_TARGET,normalizeClickRoute} from './clickContract';
import {isProtocolClientErrorCode,type ProtocolClientErrorCode} from './clientErrorCodes';
import type {ClickFact,ClientMissedFact,DiagnosticFact,ProtocolReply} from './public';

type Sender=(entries:DiagnosticFact[],scope:string|null)=>Promise<ProtocolReply>;
type Ticket={event:MouseEvent;fact:ClickFact;start:number;claimed:boolean};
type Capture={scope:string|null;ticket:Ticket|null;flush:()=>Promise<void>};
// This diagnostic buffer is deliberately separate from the durable business queue.
// It survives disconnect/reconnect and registrar remounts in this page instance;
// it does not claim persistence across a browser/process restart.
type BufferState={entries:Map<string,DiagnosticFact>;missed:number;report:ClientMissedFact|null};
const buffers=new Map<string|null,BufferState>();
const flushing=new Set<string|null>();
const dirty=new Set<string|null>();
const sessions=new Map<string,string>();
let active:Capture|null=null;

function bufferFor(scope:string|null){let buffer=buffers.get(scope);if(!buffer){buffer={entries:new Map(),missed:0,report:null};buffers.set(scope,buffer);}return buffer;}
function missed(buffer:BufferState,count=1){buffer.missed=Math.min(2147483647,buffer.missed+count);}
function put(buffer:BufferState,fact:DiagnosticFact){
 buffer.entries.set(fact.id,fact);
 while(buffer.entries.size>500){const first=buffer.entries.keys().next();if(first.done)break;buffer.entries.delete(first.value);missed(buffer);}
}
/** Known S06 code only. Never accepts an Error object, input, PIN or message. */
export function reportProtocolClientError(identifier:ProtocolClientErrorCode):void{
 if(typeof window==='undefined'||!isProtocolClientErrorCode(identifier))return;
 try{
  const marker=document.documentElement.dataset;
  const scope=active?active.scope:marker.authStatus==='authenticated'&&typeof marker.offlineScope==='string'&&/^[a-f0-9]{64}$/.test(marker.offlineScope)?marker.offlineScope:null;
  const fact={kind:'error' as const,id:crypto.randomUUID(),command:identifier,occurredAt:new Date().toISOString()};
  put(bufferFor(scope),fact);dirty.add(scope);void active?.flush();
 }catch{console.warn('[PROTOCOL_CLIENT_CAPTURE_FAILED]');}
}

function outcome(value:unknown):ClickFact['outcome']{
 if(value===null||typeof value!=='object')return null;
 const result=value as {code?:unknown;ok?:unknown};
 if(result.code==='OK'||result.ok===true)return 'success';
 if(result.ok===false||['FORBIDDEN','UNAUTHENTICATED','VALIDATION_ERROR','CONFLICT','NOT_FOUND','UNAVAILABLE','SOURCE_INCOMPLETE'].includes(String(result.code)))return 'failure';
 return null;
}
function retain(capture:Capture,ticket:Ticket,result:ClickFact['outcome'],duration:number|null){
 const buffer=buffers.get(capture.scope);if(!buffer)return;
 const fact={...ticket.fact,outcome:result,durationMs:duration};
 put(buffer,fact);
 dirty.add(capture.scope);
 void capture.flush();
}

/** Claim only a command invoked during this actual native click dispatch.
 * No last-click time window, background-RPC attribution, or inferred success. */
export async function observeProtocolCommand<T>(work:()=>Promise<T>):Promise<T>{
 const capture=active,ticket=capture?.ticket;
 if(!capture||!ticket||ticket.claimed||ticket.event.eventPhase===Event.NONE)return work();
 ticket.claimed=true;
 const duration=()=>{const ms=Math.round(performance.now()-ticket.start);return ms>=0&&ms<=3600000?ms:null;};
 try{const result=await work();try{retain(capture,ticket,outcome(result),duration());}catch{console.warn('[PROTOCOL_CLICK_CAPTURE_FAILED]');}return result;}
 catch(error){try{retain(capture,ticket,(error instanceof Error||typeof DOMException!=='undefined'&&error instanceof DOMException)&&error.name==='AbortError'?'cancelled':'failure',duration());}catch{console.warn('[PROTOCOL_CLICK_CAPTURE_FAILED]');}throw error;}
}

/** One nonvisual registrar. A different login never inherits another buffer. */
export function installProtocolClickCapture(scope:string|null,send:Sender,captureClicks=true):()=>void{
 if(scope!==null&&!/^[a-f0-9]{64}$/.test(scope))return ()=>{};
 bufferFor(scope);
 if(scope!==null&&!sessions.has(scope))sessions.set(scope,crypto.randomUUID());
 let stopped=false;
 const capture:Capture={scope,ticket:null,flush:async()=>{
  if(stopped||active!==capture||!readServerReachability())return;
  // Unknown-origin diagnostics remain unknown even after a later login.
  for(const partition of scope===null?[null]:[null,scope]){
   const buffer=buffers.get(partition);if(!buffer||(!buffer.entries.size&&!buffer.missed&&!buffer.report)||flushing.has(partition))continue;
   flushing.add(partition);dirty.delete(partition);
   try{
    const attempted=new Set<string>();let reportCreated=false;
    while(!stopped&&active===capture&&readServerReachability()){
     if(!buffer.report&&buffer.missed&&!reportCreated){buffer.report={kind:'missed',id:crypto.randomUUID(),count:buffer.missed,occurredAt:new Date().toISOString()};buffer.missed=0;reportCreated=true;}
     const entries=Array.from(buffer.entries.values()).filter(entry=>!attempted.has(entry.id)),errors=entries.filter(entry=>'kind'in entry&&entry.kind==='error');
     // A disabled click flag must never hold an error behind old clicks.
     const report=buffer.report&&!attempted.has(buffer.report.id)?[buffer.report]:[];
     const batch=[...report,...(errors.length?errors:entries)].slice(0,50);if(!batch.length)break;dirty.delete(partition);
     let response:Awaited<ReturnType<Sender>>;
     try{response=await send(batch,partition);}catch{console.warn('[PROTOCOL_TRANSPORT_FAILED]');return;}
     const accepted=response.accepted??[],rejected=response.rejected??[];
     const terminal=['DISABLED','SOURCE_INCOMPLETE','CONFLICT','VALIDATION_ERROR','FORBIDDEN','UNAUTHENTICATED'];
     if(!Array.isArray(accepted)||!Array.isArray(rejected)||!['OK','COUNTED','UNAVAILABLE',...terminal].includes(response.code))return;
     const ids=[...accepted,...rejected.map(row=>row.id)];
     if(new Set(ids).size!==ids.length||ids.some(id=>!batch.some(entry=>entry.id===id))||rejected.some(row=>!terminal.includes(row.code)))return;
     // Root-level authority/validation failures apply to the entire remaining
     // batch. Storage/network failures alone keep an original for retry.
     const finalIds=new Set(rejected.map(row=>row.id));
     if(terminal.includes(response.code))for(const entry of batch)if(!accepted.includes(entry.id))finalIds.add(entry.id);
     // ACKs are either qualified stored facts, or explicit instance-only
     // COUNTED receipts for an unattributed error; never business receipts.
     for(const entry of batch){
      attempted.add(entry.id);
      if(!accepted.includes(entry.id)&&!finalIds.has(entry.id))continue;
      if(buffer.report===entry){buffer.report=null;if(finalIds.has(entry.id)&&'kind'in entry&&entry.kind==='missed')missed(buffer,entry.count);}
      else if(buffer.entries.get(entry.id)===entry){buffer.entries.delete(entry.id);if(finalIds.has(entry.id))missed(buffer);}
     }
    }
   }finally{
    flushing.delete(partition);const again=dirty.delete(partition);
    if(active&&(again||active!==capture&&(partition===null||active.scope===partition)))void active.flush();
   }
  }
 }};
 active=capture;
 const click=(event:MouseEvent)=>{
  if(stopped||active!==capture||!captureClicks||scope===null)return;
  const element=event.target instanceof Element?event.target.closest('button,a,input,select,textarea,[role="button"]'):null;
  const target=element?.getAttribute('data-spec-id'),route=normalizeClickRoute(window.location.pathname);
  if(!target||!CLICK_TARGET.test(target)||route===null||element?.matches(':disabled,[aria-disabled="true"]'))return;
  const ticket:Ticket={event,start:performance.now(),claimed:false,fact:{id:crypto.randomUUID(),sessionId:sessions.get(scope)!,route,target,deviceClass:'unknown',outcome:null,durationMs:null,clickCount:Math.max(1,event.detail),occurredAt:new Date().toISOString()}};
  capture.ticket=ticket;
  // A local-only click has no server response. Preserve that as NULL, never 0/OK.
  setTimeout(()=>{if(!ticket.claimed)retain(capture,ticket,null,null);if(capture.ticket===ticket)capture.ticket=null;},0);
 };
 document.addEventListener('click',click,true);
 const unsubscribe=subscribeServerReachability(()=>{void capture.flush();});
 void capture.flush();
 return()=>{stopped=true;document.removeEventListener('click',click,true);unsubscribe();if(active===capture)active=null;};
}
