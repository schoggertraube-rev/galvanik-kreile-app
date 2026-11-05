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
