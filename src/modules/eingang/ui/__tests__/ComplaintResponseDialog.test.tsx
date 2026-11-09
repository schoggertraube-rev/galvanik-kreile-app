import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import type {ReactNode} from 'react';
import type {IntakeMessage,IntakeMessagesPorts} from '../../messageContract';
vi.mock('@/ui/kr',()=>({Dialog:({children,fuss,meldung,onSchliessen}:{children:ReactNode;fuss:ReactNode;meldung?:{text:string};onSchliessen:()=>void})=><section role="dialog"><button onClick={onSchliessen}>Schließen</button>{meldung?<p role="alert">{meldung.text}</p>:null}{children}{fuss}</section>,Button:({text,onClick,disabled}:{text:string;onClick:()=>void;disabled?:boolean})=><button onClick={onClick} disabled={disabled}>{text}</button>}));
import {ComplaintResponseDialog} from '../ComplaintResponseDialog';
import {REKLA_MAIL_COPY} from '@/ui/situationCatalog';
afterEach(cleanup);
it.each([true,false])('RM07 reopened response resumes the persisted key automatically (found=%s)',async(found)=>{
 const f=fixture(),done=vi.fn(),clientKey=crypto.randomUUID();
 const request={targetType:'CUSTOMER' as const,targetId:row.customerId!,clientRequestId:clientKey,subject:'TEST gespeicherte Antwort',body:'TEST Originalantwort',complaintRejection:{itemId:row.id,version:1,reason:'TEST kein Mangel'}};
 const rejectComplaint=vi.fn().mockResolvedValueOnce(found?{code:'OK',data:{}}:{code:'CONFLICT',delivery:'failed',message:'TEST secret detail'}).mockResolvedValue({code:'OK',data:{}});
 const restored={request,attempted:true,draft:{id:f.draftId,art:'eingang' as const,payload:{clientKey,request,deliveryCheckAt:new Date(Date.now()+150).toISOString()},zuletzt_feld:null,version:7,updated_at:'2026-11-09T00:00:00Z'}};
 render(<ComplaintResponseDialog row={row} ports={{...f.ports,rejectComplaint}} restored={restored} onClose={vi.fn()} onSent={done}/>);
 expect(screen.queryByRole('button',{name:'Mit gleicher Kennung erneut versuchen'})).toBeNull();
 if(!found){fireEvent.click(await screen.findByRole('button',{name:'Erneut senden'}));}
 await waitFor(()=>expect(done).toHaveBeenCalledOnce());
 expect(rejectComplaint.mock.calls[0][0]).toEqual(request);expect(rejectComplaint).toHaveBeenCalledTimes(found?1:2);
 if(found)expect(f.drafts.saveDraft).not.toHaveBeenCalled();
 else expect(rejectComplaint.mock.calls[1][0]).toMatchObject({subject:request.subject,body:request.body,clientRequestId:expect.not.stringMatching(clientKey)});
 expect(f.drafts.discardDraft).toHaveBeenCalledOnce();
});
const row={id:'b9a6adc0-67ed-42a7-a834-f3d9f8e8eb76',version:1,customerId:'TEST-customer',subject:'TEST Flecken',customerName:'TEST Kunde'} as IntakeMessage;
function fixture(){let version=0;const draftId='24802a2b-4599-44a6-b647-2b48d9a438e6';const drafts={readDrafts:vi.fn(),saveDraft:vi.fn(async(input)=>({code:'OK' as const,drafts:[{id:input.id,art:'eingang' as const,payload:input.payload,zuletzt_feld:null,version:version++,updated_at:'2026-11-09T00:00:00Z'}]})),discardDraft:vi.fn(async()=>({code:'OK' as const,drafts:[]}))};const send=vi.fn<(input:unknown)=>Promise<{code:string;message:string}|{code:'OK';data:unknown}>>().mockResolvedValue({code:'CONFLICT',message:'TEST Versand unklar'});const ports={replyDrafts:drafts,rejectComplaint:send,ReplyMailView:({composer}:{composer:{subject:string;body:string;onSubject:(v:string)=>void;onBody:(v:string)=>void}})=><><label>Betreff<input value={composer.subject} onChange={e=>composer.onSubject(e.target.value)}/></label><label>Nachricht<textarea value={composer.body} onChange={e=>composer.onBody(e.target.value)}/></label></>} as unknown as IntakeMessagesPorts;return {ports,drafts,send,draftId};}
it('does not send on open or incomplete input, saves before sending and retries the identical intent once per click',async()=>{
 const f=fixture(),done=vi.fn();render(<ComplaintResponseDialog row={row} ports={f.ports} onClose={vi.fn()} onSent={done}/>);
 expect(f.send).not.toHaveBeenCalled();expect(f.drafts.saveDraft).not.toHaveBeenCalled();fireEvent.click(screen.getByText('Antwort senden und Anliegen abschließen'));expect(screen.getByRole('alert')).toHaveTextContent('konkreten Grund');expect(f.send).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Nachricht'),{target:{value:'TEST Antwort'}});fireEvent.change(screen.getByLabelText('Grund für den Abschluss'),{target:{value:'TEST kein Mangel'}});
 const button=screen.getByText('Antwort senden und Anliegen abschließen');fireEvent.click(button);fireEvent.click(button);
 await waitFor(()=>expect(f.send).toHaveBeenCalledTimes(1));expect(f.drafts.saveDraft.mock.invocationCallOrder[0]).toBeLessThan(f.send.mock.invocationCallOrder[0]);const input=f.send.mock.calls[0][0];expect(screen.getByRole('alert')).toHaveTextContent(REKLA_MAIL_COPY.responseUnavailable);
 f.send.mockResolvedValueOnce({code:'OK',data:{}} as never);fireEvent.click(screen.getByText('Mit gleicher Kennung erneut versuchen'));await waitFor(()=>expect(done).toHaveBeenCalledOnce());expect(f.send).toHaveBeenLastCalledWith(input);expect(f.drafts.discardDraft).toHaveBeenCalledOnce();
});
it('closing keeps the edited reply in the existing actor draft rather than sending or losing it',async()=>{
 const f=fixture(),closed=vi.fn();render(<ComplaintResponseDialog row={row} ports={f.ports} onClose={closed} onSent={vi.fn()}/>);fireEvent.change(screen.getByLabelText('Nachricht'),{target:{value:'TEST später weiter'}});fireEvent.click(screen.getByText('Schließen'));await waitFor(()=>expect(closed).toHaveBeenCalledWith('Antwortentwurf gespeichert · in Der Tag weiterbearbeiten.'));expect(f.drafts.saveDraft).toHaveBeenCalledWith(expect.objectContaining({payload:expect.objectContaining({kind:'rekla-response',attempted:false,request:expect.objectContaining({body:'TEST später weiter'})})}));expect(f.send).not.toHaveBeenCalled();
});

it('RM07 confirmed source change keeps the actual send and offers reload instead of another send',async()=>{
 const f=fixture(),done=vi.fn(),clientKey=crypto.randomUUID();
 const request={targetType:'CUSTOMER' as const,targetId:row.customerId!,clientRequestId:clientKey,subject:'TEST Antwort',body:'TEST Originalantwort',complaintRejection:{itemId:row.id,version:1,reason:'TEST kein Mangel'}};
 const rejectComplaint=vi.fn().mockResolvedValue({code:'OK',data:{sourceChanged:true,deliveryCustomer:'TEST Kunde'}});
 const restored={request,attempted:true,draft:{id:f.draftId,art:'eingang' as const,payload:{clientKey,request,deliveryCheckAt:new Date(Date.now()+100).toISOString()},zuletzt_feld:null,version:7,updated_at:'2026-11-09T00:00:00Z'}};
 render(<ComplaintResponseDialog row={row} ports={{...f.ports,rejectComplaint}} restored={restored} onClose={vi.fn()} onSent={done}/>);
 await screen.findByText('Die Mail an TEST Kunde ist rausgegangen. Der Vorgang wurde inzwischen geändert – lies ihn neu, die Mail steht im Verlauf.');
 expect(screen.queryByRole('button',{name:REKLA_MAIL_COPY.responseRetry})).toBeNull();expect(done).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Neu laden'}));expect(done).toHaveBeenCalledOnce();expect(rejectComplaint).toHaveBeenCalledOnce();
});
