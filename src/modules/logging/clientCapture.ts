import {readServerReachability,subscribeServerReachability} from '@/lib/offline/serverReachability';
import {CLICK_TARGET,normalizeClickRoute} from './clickContract';
import type {ClickFact} from './public';

type Sender=(entries:ClickFact[],scope:string)=>Promise<{code:string;accepted?:string[]}>;
type Ticket={event:MouseEvent;fact:ClickFact;start:number;claimed:boolean};
type Capture={scope:string;ticket:Ticket|null;flush:()=>Promise<void>};
// This diagnostic buffer is deliberately separate from the durable business queue.
// It survives disconnect/reconnect and registrar remounts in this page instance;
// it does not claim persistence across a browser/process restart.
const buffers=new Map<string,Map<string,ClickFact>>();
const flushing=new Set<string>();
const sessions=new Map<string,string>();
let active:Capture|null=null;

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
 buffer.set(fact.id,fact);
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
export function installProtocolClickCapture(scope:string,send:Sender):()=>void{
 if(!/^[a-f0-9]{64}$/.test(scope))return ()=>{};
 if(!buffers.has(scope))buffers.set(scope,new Map());
 if(!sessions.has(scope))sessions.set(scope,crypto.randomUUID());
 const buffer=buffers.get(scope)!;
 let stopped=false;
 const capture:Capture={scope,ticket:null,flush:async()=>{
  if(stopped||active!==capture||flushing.has(scope)||!readServerReachability())return;
  flushing.add(scope);
  try{
   while(!stopped&&active===capture&&buffer.size&&readServerReachability()){
    const batch=Array.from(buffer.values()).slice(0,50);
    let response:Awaited<ReturnType<Sender>>;
    try{response=await send(batch,scope);}catch{return;}
    const accepted=response.accepted;
    if(response.code!=='OK'||!Array.isArray(accepted)||accepted.length!==batch.length||new Set(accepted).size!==batch.length||batch.some(entry=>!accepted.includes(entry.id)))return;
    // Only an exact authenticated acknowledgement removes diagnostic originals.
    for(const entry of batch)if(buffer.get(entry.id)===entry)buffer.delete(entry.id);
   }
  }finally{flushing.delete(scope);if(active&&active!==capture&&active.scope===scope)void active.flush();}
 }};
 active=capture;
 const click=(event:MouseEvent)=>{
  if(stopped||active!==capture)return;
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
