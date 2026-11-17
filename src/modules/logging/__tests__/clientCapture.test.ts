// @vitest-environment jsdom
// Controlled DOM/transport unit boundaries, not a browser/Appstart acceptance.
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {installProtocolClickCapture,observeProtocolCommand,reportProtocolClientError} from '../public';
import type {DiagnosticFact} from '../public';
import * as reachability from '@/lib/offline/serverReachability';
import {runServerAction} from '@/lib/client/runServerAction';
let online=false;
const cleanups:Array<()=>void>=[];
beforeEach(()=>{vi.useFakeTimers();online=false;vi.spyOn(reachability,'readServerReachability').mockImplementation(()=>online);document.body.innerHTML='<button data-spec-id="rechte.rechte-speichern">TEST command</button>';history.replaceState({},'','/orders/TEST-object?PRIVATE_QUERY');});
afterEach(()=>{for(const stop of cleanups.splice(0))stop();vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();document.body.innerHTML='';delete document.documentElement.dataset.authStatus;delete document.documentElement.dataset.offlineScope;});
const scope=()=>randomUUID().replaceAll('-','').repeat(2);
const press=(detail=1)=>document.querySelector('button')!.dispatchEvent(new MouseEvent('click',{bubbles:true,detail}));
const reconnect=async()=>{online=true;window.dispatchEvent(new Event('online'));await vi.advanceTimersByTimeAsync(0);};

it('buffers a real command response offline, then acknowledges the exact hang/repeat fact through the one reachability predicate',async()=>{
 const batches:DiagnosticFact[][]=[],partition=scope();
 cleanups.push(installProtocolClickCapture(partition,async entries=>{batches.push(structuredClone(entries));return {code:'OK',accepted:entries.map(row=>row.id)};}));
 let release!:()=>void,execution:ReturnType<typeof runServerAction>|undefined;
 const blocked=new Promise<void>(resolve=>{release=resolve;});
 document.querySelector('button')!.addEventListener('click',()=>{execution=runServerAction(async()=>{await blocked;return {code:'OK'};});});
 press(2);await vi.advanceTimersByTimeAsync(3500);expect(batches).toHaveLength(0);
 release();expect(await execution).toEqual({ok:true,value:{code:'OK'}});expect(batches).toHaveLength(0);
 await reconnect();expect(batches).toHaveLength(1);
 expect(batches[0]).toMatchObject([{target:'rechte.rechte-speichern',route:'/orders/:id',durationMs:3500,clickCount:2,outcome:'success',deviceClass:'unknown'}]);
 expect(JSON.stringify(batches)).not.toContain('PRIVATE_QUERY');
 await reconnect();expect(batches).toHaveLength(1);
});

it('a background command after native dispatch cannot turn a local click into a fabricated successful server response',async()=>{
 const batches:DiagnosticFact[][]=[];
 cleanups.push(installProtocolClickCapture(scope(),async entries=>{batches.push(structuredClone(entries));return {code:'OK',accepted:entries.map(row=>row.id)};}));
 press();expect(await observeProtocolCommand(async()=>({code:'OK'}))).toEqual({code:'OK'});
 await vi.advanceTimersByTimeAsync(0);await reconnect();
 expect(batches[0]).toMatchObject([{outcome:null,durationMs:null}]);
});

it('a failed acknowledgement retains immutable click metadata for the next registrar retry',async()=>{
 const partition=scope(),attempts:DiagnosticFact[][]=[];
 const stop=installProtocolClickCapture(partition,async entries=>{attempts.push(structuredClone(entries));return {code:'UNAVAILABLE'};});cleanups.push(stop);
 press();await vi.advanceTimersByTimeAsync(0);await reconnect();expect(attempts).toHaveLength(1);stop();
 cleanups.push(installProtocolClickCapture(partition,async entries=>{attempts.push(structuredClone(entries));return {code:'OK',accepted:entries.map(row=>row.id)};}));
 await vi.advanceTimersByTimeAsync(0);expect(attempts).toHaveLength(2);expect(attempts[1]).toEqual(attempts[0]);
});

it('an in-flight old login is never sent under a new login; returning to its actual scope retains the original',async()=>{
 const old=scope(),next=scope(),oldSend=vi.fn(async(entries:DiagnosticFact[])=>({code:'OK',accepted:entries.map(row=>row.id)})),newSend=vi.fn(async(entries:DiagnosticFact[])=>({code:'OK',accepted:entries.map(row=>row.id)}));
 const stop=installProtocolClickCapture(old,oldSend);cleanups.push(stop);
 let release!:()=>void,execution:Promise<unknown>|undefined;
 const blocked=new Promise<void>(resolve=>{release=resolve;});
 document.querySelector('button')!.addEventListener('click',()=>{execution=observeProtocolCommand(async()=>{await blocked;return {code:'OK'};});});
 press();stop();const stopNext=installProtocolClickCapture(next,newSend);cleanups.push(stopNext);release();await execution;await reconnect();
 expect(oldSend).not.toHaveBeenCalled();expect(newSend).not.toHaveBeenCalled();stopNext();
 cleanups.push(installProtocolClickCapture(old,oldSend));await vi.advanceTimersByTimeAsync(0);
 expect(oldSend).toHaveBeenCalledTimes(1);expect(oldSend.mock.calls[0][0]).toMatchObject([{outcome:'success'}]);
});

it('an actual command AbortError remains the same exception and records cancellation without reading its text',async()=>{
 const batches:DiagnosticFact[][]=[];
 cleanups.push(installProtocolClickCapture(scope(),async entries=>{batches.push(structuredClone(entries));return {code:'OK',accepted:entries.map(row=>row.id)};}));
 const failure=new DOMException('TEST PRIVATE_ABORT_BODY','AbortError');let execution:Promise<unknown>|undefined;
 document.querySelector('button')!.addEventListener('click',()=>{execution=observeProtocolCommand(async()=>{throw failure;}).catch(error=>error);});
 press();expect(await execution).toBe(failure);await reconnect();
 expect(batches[0]).toMatchObject([{outcome:'cancelled'}]);expect(JSON.stringify(batches)).not.toContain('PRIVATE_ABORT_BODY');
});

it('a disabled click flag keeps known diagnostic errors moving without recording local clicks',async()=>{
 const batches:DiagnosticFact[][]=[];
 cleanups.push(installProtocolClickCapture(scope(),async entries=>{batches.push(structuredClone(entries));return {code:'OK',accepted:entries.map(row=>row.id)};},false));
 press();reportProtocolClientError('OFFLINE_PENDING_READ_FAILED');await vi.advanceTimersByTimeAsync(0);expect(batches).toHaveLength(0);
 await reconnect();expect(batches).toHaveLength(1);expect(batches[0]).toMatchObject([{kind:'error',command:'OFFLINE_PENDING_READ_FAILED'}]);expect(Object.keys(batches[0][0]).sort()).toEqual(['command','id','kind','occurredAt']);
});

it('partial confirmed diagnostic receipts remove only confirmed facts and preserve the remaining original for retry',async()=>{
 const partition=scope(),attempts:DiagnosticFact[][]=[];
 const stop=installProtocolClickCapture(partition,async entries=>{attempts.push(structuredClone(entries));return {code:'UNAVAILABLE',accepted:[entries[0].id]};},false);cleanups.push(stop);
 reportProtocolClientError('OFFLINE_PENDING_READ_FAILED');reportProtocolClientError('OFFLINE_SYNC_UNAVAILABLE');await reconnect();expect(attempts).toHaveLength(1);expect(attempts[0]).toHaveLength(2);stop();
 cleanups.push(installProtocolClickCapture(partition,async entries=>{attempts.push(structuredClone(entries));return {code:'OK',accepted:entries.map(row=>row.id)};},false));
 await vi.advanceTimersByTimeAsync(0);expect(attempts).toHaveLength(2);expect(attempts[1]).toEqual([attempts[0][1]]);
});

it('unattributed errors override stale HTML identity and remain count-only during a later login',async()=>{
 document.documentElement.dataset.authStatus='authenticated';document.documentElement.dataset.offlineScope=scope();
 const sent:Array<{scope:string|null;entries:DiagnosticFact[]}>=[];
 let release!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve;});
 const stop=installProtocolClickCapture(null,async(entries,partition)=>{sent.push({scope:partition,entries:structuredClone(entries)});await blocked;return {code:'COUNTED',accepted:entries.map(row=>row.id)};},false);cleanups.push(stop);
 reportProtocolClientError('OFFLINE_PENDING_READ_FAILED');online=true;window.dispatchEvent(new Event('online'));expect(sent).toHaveLength(1);stop();
 const later=vi.fn(async(entries:DiagnosticFact[])=>({code:'OK',accepted:entries.map(row=>row.id)}));cleanups.push(installProtocolClickCapture(scope(),later,false));release();await vi.advanceTimersByTimeAsync(0);
 expect(sent[0].scope).toBeNull();expect(sent[0].entries).toHaveLength(1);expect(later).not.toHaveBeenCalled();
});

it('600 actual DOM clicks offline keep only the newest 500 facts and report the 100 missed entries once',async()=>{
 const batches:DiagnosticFact[][]=[];
 cleanups.push(installProtocolClickCapture(scope(),async entries=>{batches.push(structuredClone(entries));return {code:'OK',accepted:entries.map(row=>row.id),rejected:[]};}));
 for(let i=0;i<600;i++){document.querySelector('button')!.setAttribute('data-spec-id','click.'+String(i).padStart(4,'0'));press();}
 await vi.advanceTimersByTimeAsync(0);expect(batches).toHaveLength(0);await reconnect();
 const facts=batches.flat(),clicks=facts.filter(row=>!('kind'in row)),losses=facts.filter(row=>'kind'in row&&row.kind==='missed');
 expect(clicks).toHaveLength(500);expect(clicks[0]).toMatchObject({target:'click.0100'});expect(clicks[499]).toMatchObject({target:'click.0599'});
 expect(losses).toHaveLength(1);expect(losses[0]).toMatchObject({kind:'missed',count:100});
 const sent=batches.length;await reconnect();expect(batches).toHaveLength(sent);
});

it('a final rejected original is removed, counted and cannot block later batches; only unavailable entries retain their identity',async()=>{
 const batches:DiagnosticFact[][]=[],partition=scope();let rejectedId='';
 const stop=installProtocolClickCapture(partition,async entries=>{
  batches.push(structuredClone(entries));
  if(!rejectedId){rejectedId=entries[0].id;return {code:'OK',accepted:entries.slice(1).map(row=>row.id),rejected:[{id:rejectedId,code:'VALIDATION_ERROR'}]};}
  return {code:'OK',accepted:entries.map(row=>row.id),rejected:[]};
 });cleanups.push(stop);
 for(let i=0;i<75;i++)press();await vi.advanceTimersByTimeAsync(0);await reconnect();
 expect(batches[0]).toHaveLength(50);expect(batches.flat().filter(row=>!('kind'in row))).toHaveLength(75);
 expect(batches.flat().filter(row=>'kind'in row&&row.kind==='missed')).toMatchObject([{count:1}]);
 stop();const retry=vi.fn(async(entries:DiagnosticFact[])=>({code:'OK',accepted:entries.map(row=>row.id)}));
 cleanups.push(installProtocolClickCapture(partition,retry));await vi.advanceTimersByTimeAsync(0);expect(retry).not.toHaveBeenCalled();
});

it('transport exceptions retain originals and warn with a fixed identifier without private contents',async()=>{
 const partition=scope(),warn=vi.spyOn(console,'warn').mockImplementation(()=>{}),attempts:DiagnosticFact[][]=[];
 const stop=installProtocolClickCapture(partition,async entries=>{attempts.push(structuredClone(entries));throw Error('PRIVATE_TRANSPORT_BODY');});cleanups.push(stop);
 press();await vi.advanceTimersByTimeAsync(0);await reconnect();stop();
 expect(warn).toHaveBeenCalledWith('[PROTOCOL_TRANSPORT_FAILED]');expect(JSON.stringify(warn.mock.calls)).not.toContain('PRIVATE_TRANSPORT_BODY');
 cleanups.push(installProtocolClickCapture(partition,async entries=>{attempts.push(structuredClone(entries));return {code:'OK',accepted:entries.map(row=>row.id)};}));await vi.advanceTimersByTimeAsync(0);expect(attempts[1]).toEqual(attempts[0]);
});
