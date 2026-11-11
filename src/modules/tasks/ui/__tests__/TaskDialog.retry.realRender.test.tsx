// @vitest-environment jsdom
// Branch coverage for the supplied G09 sequence; its replay-DB case remains unchanged.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TaskDialog, type TaskPorts } from '../TaskDialog';
import type { TaskOpenRequest, TaskReadResult,TaskRecord } from '../../contract';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('H2 exposes the existing completion with the source-bound cancellation caption and optional note',async()=>{
 const task:TaskRecord={id:'11111111-1111-4111-8111-111111111111',client_key:'22222222-2222-4222-8222-222222222222',art:'aufgabe',titel:'TEST Storno senden',faellig_am:'2026-11-11',uhrzeit:null,vorlauf_tage:0,fuer_login:null,fuer_bereich:'geld',bezug_typ:'allgemein',bezug_id:null,item_id:null,notiz:'TEST source facts',status:'offen',erledigt_von:null,erledigt_am:null,erledigt_notiz:null,erstellt_von:'33333333-3333-4333-8333-333333333333',erstellt_am:'2026-11-11T10:00:00Z',version:1};
 const initial:Extract<TaskReadResult,{code:'OK'}>={code:'OK',task,currentLogin:task.erstellt_von,reference:{type:'allgemein',id:null,label:null,customerId:null,customerType:null,orderId:null,channel:null,phone:null,sourceVersion:null},canEdit:false,canComplete:true,completeLabel:'Storno an TEST Kunde gesendet',canOpenReference:false};
 const completed={...task,status:'erledigt' as const,version:2};
 const complete=vi.fn<TaskPorts['complete']>().mockResolvedValue({code:'OK',task:completed,replayed:false});
 const ports:TaskPorts={read:vi.fn().mockResolvedValueOnce(initial).mockResolvedValue({...initial,task:completed,canComplete:false}),save:vi.fn(),complete,canManageMoney:true,referenceTargets:[],openReference:vi.fn()};
 const close=vi.fn();const {container}=render(<TaskDialog request={{taskId:task.id}} ports={ports} onClose={close} onMessage={vi.fn()}/>);
 const button=await screen.findByRole('button',{name:'Storno an TEST Kunde gesendet'});
 expect(screen.queryByRole('button',{name:'Speichern'})).toBeNull();
 const note=container.querySelector<HTMLTextAreaElement>('[data-spec-id="aufgabe.notiz"]')!;
 expect(note.disabled).toBe(false);fireEvent.change(note,{target:{value:''}});fireEvent.click(button);
 await waitFor(()=>expect(complete).toHaveBeenCalledExactlyOnceWith({taskId:task.id,version:1,note:null}));
 await waitFor(()=>expect(close).toHaveBeenCalledOnce());
});

it('G09 keeps a transport-failed write unchanged until the explicit main action after Erneut', async () => {
  const read: TaskReadResult = {
    code: 'OK', task: null, currentLogin: '11111111-1111-4111-8111-111111111111',
    reference: { type: 'allgemein', id: null, label: null, customerId: null, customerType: null, orderId: null, channel: null, phone: null, sourceVersion: null },
    canEdit: true, canComplete: false, canOpenReference: false,
  };
  const save = vi.fn<TaskPorts['save']>()
    .mockRejectedValueOnce(new Error('SYNTHETIC_NETWORK_INTERRUPTION'))
    .mockResolvedValueOnce({ code: 'UNAVAILABLE', message: 'Synthetischer zweiter Versuch.' });
  const ports: TaskPorts = { read: vi.fn().mockResolvedValue(read), save, complete: vi.fn(), canManageMoney: false, referenceTargets: [], openReference: vi.fn() };
  const request: TaskOpenRequest = { reference: { type: 'allgemein', id: null }, kind: 'aufgabe' };
  const close = vi.fn();
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { container } = render(<TaskDialog request={request} ports={ports} onClose={close} onMessage={vi.fn()} />);
  await waitFor(() => expect(container.querySelector('[data-spec-id="aufgabe.titel"]')).toBeTruthy());
  const title = container.querySelector<HTMLInputElement>('[data-spec-id="aufgabe.titel"]')!;
  fireEvent.change(title, { target: { value: 'Synthetische G09-Aufgabe' } });
  fireEvent.click(screen.getByRole('button', { name: 'Auf Der Tag' }));
  await screen.findByText(/TASK_DIALOG_WRITE_FAILED/);
  expect(save).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenCalledWith('[TASK_DIALOG_WRITE_FAILED]', expect.any(Error));

  fireEvent.click(screen.getByRole('button', { name: 'Erneut' }));
  await waitFor(() => expect(screen.queryByText(/TASK_DIALOG_WRITE_FAILED/)).toBeNull());
  expect(save).toHaveBeenCalledTimes(1);
  expect(title.value).toBe('Synthetische G09-Aufgabe');
  expect(close).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Auf Der Tag' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0]);
});
