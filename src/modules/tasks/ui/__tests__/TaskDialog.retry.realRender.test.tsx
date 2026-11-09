// @vitest-environment jsdom
// Branch coverage for the supplied G09 sequence; its replay-DB case remains unchanged.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TaskDialog, type TaskPorts } from '../TaskDialog';
import type { TaskOpenRequest, TaskReadResult } from '../../contract';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

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


it('RM14 requires an explicit named person and reuses the same task dialog and writer',async()=>{
 const oldScroll=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'scrollIntoView'),scroll=vi.fn();Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:scroll});
 const actor='11111111-1111-4111-8111-111111111111',person='22222222-2222-4222-8222-222222222222';
 const read:TaskReadResult={code:'OK',task:null,currentLogin:actor,reference:{type:'eingang',id:'33333333-3333-4333-8333-333333333333',label:'TEST Foto-Mail',customerId:null,customerType:null,orderId:null,channel:'mail',phone:null,sourceVersion:1},canEdit:true,canComplete:false,canOpenReference:true,recipients:[{id:person,name:'TEST Phillip'}]};
 const save=vi.fn<TaskPorts['save']>().mockResolvedValue({code:'CONFLICT',message:'TEST changed task'}),ports:TaskPorts={read:vi.fn().mockResolvedValue(read),save,complete:vi.fn(),canManageMoney:false,referenceTargets:['eingang'],openReference:vi.fn()};
 const request:TaskOpenRequest={reference:{type:'eingang',id:read.reference.id},kind:'aufgabe',handover:'complaint'};
 const {container}=render(<TaskDialog request={request} ports={ports} onClose={vi.fn()} onMessage={vi.fn()}/>);
 await screen.findByDisplayValue('Reklamation prüfen · TEST Foto-Mail');fireEvent.click(screen.getByRole('button',{name:'Auf Der Tag'}));expect(save).not.toHaveBeenCalled();await waitFor(()=>expect(scroll).toHaveBeenCalled());
 const select=container.querySelector<HTMLSelectElement>('[data-spec-id="aufgabe.fuer"]')!;expect(select.value).toBe('');expect(screen.queryByRole('option',{name:'ich'})).toBeNull();
 fireEvent.change(select,{target:{value:'login:'+person}});fireEvent.click(screen.getByRole('button',{name:'An TEST Phillip übergeben'}));await waitFor(()=>expect(save).toHaveBeenCalledOnce());
 expect(save.mock.calls[0][0]).toMatchObject({forLogin:person,forArea:null,reference:request.reference,title:'Reklamation prüfen · TEST Foto-Mail'});expect(save.mock.calls[0][0]).not.toHaveProperty('itemId');
 if(oldScroll)Object.defineProperty(HTMLElement.prototype,'scrollIntoView',oldScroll);else Reflect.deleteProperty(HTMLElement.prototype,'scrollIntoView');
});
